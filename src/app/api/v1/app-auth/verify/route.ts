import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmail } from "@/lib/accounts";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";

/**
 * `POST /api/v1/app-auth/verify` — prove an e-mail address.
 *
 * E-mail is the identity now (D-18), so it is worth proving once. `requestEmailVerification` and
 * `verifyEmail` have existed in `lib/accounts.ts` since that decision and **nothing has ever called
 * them**: there was no route and no page, so `emailVerifiedAt` was set for nobody. This is the
 * missing half.
 *
 * **POST, not GET, and that is the whole reason the page exists.** Corporate mail security —
 * Defender Safe Links, Mimecast, Barracuda — fetches every link in a message before its owner sees
 * it. A verification consumed by that fetch is one the person can never complete, and they are told
 * their link is invalid with no way to find out why. So the link opens a page, the page spends
 * nothing, and this route is reached only when somebody presses the button.
 *
 * `verifyEmail` is idempotent: a second press, or a person who verified on another device, gets
 * the same answer rather than an error about something that already worked.
 */
const BodySchema = z.object({ credential: z.string().trim().min(10).max(200) });

const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 20;

export async function POST(req: Request) {
  try {
    enforceRateLimit(`verify-email:${callerIp(req)}`, {
      limit: PER_CALLER,
      windowMs: WINDOW_MS,
      code: "VERIFICATION_RATE_LIMITED"
    });
    const body = await parseBody(req, BodySchema);
    const user = await verifyEmail(body.credential);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
