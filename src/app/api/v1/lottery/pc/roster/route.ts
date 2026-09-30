import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { authorizeLotteryPc, lotteryBody, lotteryRoster, pcRateLimit, RosterSchema } from "@/lib/lottery-pc";

/**
 * `POST /api/v1/lottery/pc/roster`: the lottery PC asks, for the people it holds a verifier for,
 * who may still use lottery at its store. Anyone answered `gone` is deleted from the PC and their
 * session ended at once. Only people with an active assignment here and a lottery page are
 * `active`; everyone else, an unknown email included, is `gone`.
 */
export async function POST(req: Request) {
  try {
    const { claims } = await authorizeLotteryPc(req);
    pcRateLimit("lottery-roster", String(claims.pc), 60, "RATE_LIMITED");
    const body = await lotteryBody(req, RosterSchema);
    return NextResponse.json(await lotteryRoster(claims, body.emails), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
