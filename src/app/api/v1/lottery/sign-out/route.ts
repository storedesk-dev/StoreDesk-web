import { NextResponse } from "next/server";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import { lotteryBody, SignOutSchema } from "@/lib/lottery-pc";
import { signOutRefreshCredential } from "@/lib/lottery-refresh";

/**
 * `POST /api/v1/lottery/sign-out`: "Remove from this PC" revokes the person's refresh credential.
 * The credential is the proof, so there is no other auth, and the answer is always `{ ok: true }`:
 * the call cannot be used to find out whether a credential exists.
 */
export async function POST(req: Request) {
  try {
    enforceRateLimit(`lottery-sign-out:${callerIp(req)}`, { limit: 60, windowMs: 60 * 60_000, code: "RATE_LIMITED" });
    const body = await lotteryBody(req, SignOutSchema);
    await signOutRefreshCredential(body.refreshCredential);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
