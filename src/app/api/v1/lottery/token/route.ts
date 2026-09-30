import { NextResponse } from "next/server";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import { lotteryBody, lotteryToken, TokenSchema } from "@/lib/lottery-pc";

/**
 * `POST /api/v1/lottery/token`: a person's refresh credential on a lottery PC buys fifteen minutes
 * of the lottery cloud, and a new refresh credential. Every call rotates; an old generation
 * presented again revokes the family.
 *
 * The claims are rebuilt from Mongo each time, so a role change lands within fifteen minutes and a
 * disabled person is refused on the next call. It also records the PC as seen, which is what the
 * admin card reads.
 *
 * The per-PC limit (120 an hour) is counted inside `lotteryToken`, after the credential checks out,
 * so a stranger who knows a pcId cannot starve that PC. Before that, only the per-IP limit applies.
 */
export async function POST(req: Request) {
  try {
    enforceRateLimit(`lottery-token-ip:${callerIp(req)}`, { limit: 600, windowMs: 60 * 60_000, code: "TOKEN_RATE_LIMITED" });
    const body = await lotteryBody(req, TokenSchema);
    return NextResponse.json(await lotteryToken(body), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
