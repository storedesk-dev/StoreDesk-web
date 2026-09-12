import { NextResponse } from "next/server";
import { RedeemSchema, redeemSetupKey } from "@/lib/control-plane";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";

/**
 * Public: the store server redeems its setup key. Rate-limited per caller
 * address (P13) as well as per key — the key id is chosen by the caller, so
 * that limit alone does not stop someone trying many keys.
 */
const REDEEM_WINDOW_MS = 15 * 60_000;
const REDEEM_PER_CALLER = 30;

export async function POST(req: Request) {
  try {
    enforceRateLimit(`redeem-ip:${callerIp(req)}`, {
      limit: REDEEM_PER_CALLER,
      windowMs: REDEEM_WINDOW_MS,
      code: "ACTIVATION_RATE_LIMITED"
    });
    const body = await parseBody(req, RedeemSchema, "ACTIVATION_REQUEST_INVALID");
    return NextResponse.json(await redeemSetupKey(body), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
