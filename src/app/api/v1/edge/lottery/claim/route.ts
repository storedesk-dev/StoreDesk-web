import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateWorker } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";
import { claimLotteryForWorker } from "@/lib/lottery-setup";

/**
 * The store's own StoreDesk Service claims a lottery PC for its store — so a store that already runs
 * StoreDesk types nothing at all to start using StoreDesk Lottery.
 *
 * The caller is the service, proved by its worker credential, which is bound to exactly one store.
 * A setup key would add no security here: the service already holds a stronger secret. The key path
 * (`/api/v1/lottery/setup-keys/redeem`) stays for a lottery-only store, which has no service.
 */
/**
 * What the StoreDesk Service actually posts, which is not what this used to accept.
 *
 * `LotteryClaimService.cs` sends `product: "lottery"` to keep the audit line readable, and sends
 * `appVersion` as JSON null when the desktop did not supply one. Against a `.strict()` schema with
 * neither, the body was refused and the owner got `appVersion: Invalid input: expected string,
 * received null` on the one screen that is supposed to need nothing typed at all.
 *
 * So `product` is accepted and ignored — the control plane decides the product from the
 * installation, never from the caller — and `appVersion` may be absent, null or empty.
 */
const ClaimSchema = z
  .object({
    deviceName: z.string().trim().min(1).max(120),
    appVersion: z.string().trim().max(40).nullish(),
    product: z.literal("lottery").optional()
  })
  .strict();

export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    enforceRateLimit(`lottery-claim:${worker.workerInstallationId}`, { limit: 10, windowMs: 60_000, code: "RATE_LIMITED" });
    const body = await parseBody(req, ClaimSchema);
    // `product` is the caller naming itself; the installation decides the real one. A null or empty
    // appVersion is simply "it did not say", not a version of "".
    const claim = {
      deviceName: body.deviceName,
      ...(body.appVersion ? { appVersion: body.appVersion } : {})
    };
    return NextResponse.json(await claimLotteryForWorker(worker, claim), {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
