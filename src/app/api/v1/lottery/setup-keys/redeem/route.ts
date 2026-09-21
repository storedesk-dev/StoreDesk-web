import { NextResponse } from "next/server";
import { z } from "zod";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";
import { redeemLotterySetupKey } from "@/lib/lottery-setup";

/**
 * Public: a StoreDesk Lottery PC claims its store. Rate-limited per caller as well as per key,
 * because the key id is chosen by the caller and that limit alone would not stop someone trying many.
 *
 * Separate from the StoreDesk redeem on purpose: a lottery PC has no tunnel, no relay key and no
 * register configuration, and this route never returns any of them.
 */
const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 30;

const ClaimSchema = z
  .object({
    setupKey: z.string().trim().min(1),
    deviceName: z.string().trim().min(1).max(120),
    appVersion: z.string().trim().max(40).optional()
  })
  .strict();

export async function POST(req: Request) {
  try {
    enforceRateLimit(`lottery-redeem-ip:${callerIp(req)}`, {
      limit: PER_CALLER,
      windowMs: WINDOW_MS,
      code: "ACTIVATION_RATE_LIMITED"
    });
    const body = await parseBody(req, ClaimSchema, "ACTIVATION_REQUEST_INVALID");
    return NextResponse.json(await redeemLotterySetupKey(body), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
