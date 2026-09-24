import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { revealStoreSetupKey } from "@/lib/store-setup-key";

type Ctx = { params: Promise<{ storeId: string }> };

/**
 * Reveal the store's reusable setup key: `{keyId, setupKey, workerInstallationId}`.
 * Internal admin; 10 a minute per admin; audited `setup_key.reveal`. Never
 * part of a page payload: the store page asks for it on an explicit "Show"
 * click. 404 SETUP_KEY_NOT_FOUND (no reusable key yet), 409
 * SETUP_KEY_NOT_READABLE (issued without STORE_SECRET_KEY: rotate it).
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await revealStoreSetupKey(admin, storeId), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
