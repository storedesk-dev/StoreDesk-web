import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { RotateSetupKeySchema, rotateStoreSetupKey } from "@/lib/store-setup-key";

type Ctx = { params: Promise<{ storeId: string }> };

/**
 * Rotate the store's setup key: the old key stops working, a new reusable key
 * is returned `{keyId, setupKey, readable, workerInstallationId}`. The running
 * PC keeps working. Body `{workerInstallationId?}` when the store has several
 * PCs. Audited `setup_key.rotate`.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    const body = await parseBody(req, RotateSetupKeySchema);
    return NextResponse.json(await rotateStoreSetupKey(admin, storeId, body), {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
