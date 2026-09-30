import { NextResponse } from "next/server";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import { lotteryBody, lotterySignIn, SignInSchema } from "@/lib/lottery-pc";

/**
 * `POST /api/v1/lottery/sign-in`: a StoreDesk Lottery PC signs a person in with email and
 * password (D-26). No setup key, no org tag, no device credential.
 *
 * Without `storeId` (first run) it answers the stores this person may run lottery at, greyed with
 * the reason where they cannot, and a five-minute ticket for `/bind`. With `storeId` (a bound PC)
 * it answers a session: the person, their role and lottery pages, and a refresh credential for the
 * cloud that the PC keeps sealed.
 *
 * Public, so rate-limited twice: here by caller before the database is touched, and inside
 * `signIn` per address and per email, counted before the password is checked.
 */
const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 40;

export async function POST(req: Request) {
  try {
    const ip = callerIp(req);
    enforceRateLimit(`lottery-sign-in:${ip}`, { limit: PER_CALLER, windowMs: WINDOW_MS, code: "LOGIN_RATE_LIMITED" });
    const body = await lotteryBody(req, SignInSchema);
    return NextResponse.json(await lotterySignIn(body, ip), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
