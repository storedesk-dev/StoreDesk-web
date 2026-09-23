import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, signIn } from "@/lib/accounts";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";

/**
 * `POST /api/v1/app-auth/sign-in` — email and password, no organization tag.
 *
 * Answers who the person is and every store they can reach, grouped by
 * organization: one store goes straight in, several show a picker (D-18). It
 * mints nothing — a StoreDesk app still signs in at its own store server, and
 * the lottery token comes from a separate route in P2 — so what this returns
 * is a directory answer, not a session.
 *
 * Public, therefore rate-limited twice: in front of the database by caller, and
 * inside `signIn` per address and per email, counted before the password is
 * checked so parallel attempts cannot slip past the lockout.
 */
const SignInSchema = z.object({ email: EmailSchema, password: z.string().min(1).max(200) });

const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 40;

export async function POST(req: Request) {
  try {
    const ip = callerIp(req);
    enforceRateLimit(`app-sign-in:${ip}`, { limit: PER_CALLER, windowMs: WINDOW_MS, code: "LOGIN_RATE_LIMITED" });

    const body = await parseBody(req, SignInSchema);
    const result = await signIn({ email: body.email, password: body.password, ip });

    const stores = result.organizations.flatMap((organization) => organization.stores);
    return NextResponse.json({
      user: result.user,
      organizations: result.organizations,
      // What the app does next, said plainly, so a phone does not have to work it out.
      next: stores.length === 0 ? "no_stores" : stores.length === 1 ? "one_store" : "pick_a_store"
    });
  } catch (error) {
    return jsonError(error);
  }
}
