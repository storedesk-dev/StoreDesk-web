import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { RedeemSupportCodeSchema, redeemSupportCode } from "@/lib/support-codes";

/**
 * The store PC redeems a support code StoreDesk staff read to the store:
 * `{code}` → 200 `{ok: true, expiresAt, issuedBy}`. Worker credential; the
 * code must be for the calling installation's store. 404
 * SUPPORT_CODE_INVALID (unknown or another store's), 410
 * SUPPORT_CODE_EXPIRED, 409 SUPPORT_CODE_USED, 429 per installation.
 * Audited `support_code.redeem` with the result.
 */
export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const body = await parseBody(req, RedeemSupportCodeSchema);
    return NextResponse.json(await redeemSupportCode(worker, body.code), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
