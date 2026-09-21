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
const ClaimSchema = z
  .object({ deviceName: z.string().trim().min(1).max(120), appVersion: z.string().trim().max(40).optional() })
  .strict();

export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    enforceRateLimit(`lottery-claim:${worker.workerInstallationId}`, { limit: 10, windowMs: 60_000, code: "RATE_LIMITED" });
    const body = await parseBody(req, ClaimSchema);
    return NextResponse.json(await claimLotteryForWorker(worker, body), {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
