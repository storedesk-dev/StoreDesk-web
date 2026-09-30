import { NextResponse } from "next/server";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import { BindSchema, lotteryBind, lotteryBody } from "@/lib/lottery-pc";

/**
 * `POST /api/v1/lottery/bind`: the store picked on a PC's first run becomes that PC's store.
 *
 * The ticket from `/sign-in` is the proof a password was checked a moment ago; this call spends it
 * whatever the answer. One lottery PC per store: taking over from another PC needs
 * `takeOver: true` **and** `lotterySettings` at that store, checked here, and it is audited.
 */
const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 20;

export async function POST(req: Request) {
  try {
    enforceRateLimit(`lottery-bind:${callerIp(req)}`, { limit: PER_CALLER, windowMs: WINDOW_MS, code: "BIND_RATE_LIMITED" });
    const body = await lotteryBody(req, BindSchema);
    return NextResponse.json(await lotteryBind(body), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
