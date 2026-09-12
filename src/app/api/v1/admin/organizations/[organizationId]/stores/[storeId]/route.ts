import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { gone, jsonError, parseBody } from "@/lib/http";
import { StorePatchSchema, deleteStore, getStoreDetail, updateStore } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(await getStoreDetail(organizationId, storeId));
  } catch (error) {
    return jsonError(error);
  }
}

/** Name, number, address, contact e-mail, status (active | suspended | closed). */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await parseBody(req, StorePatchSchema);
    return NextResponse.json({ store: await updateStore(admin, organizationId, storeId, body) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Turned off (P2): it accepted a client-built `configJson` — stale copies
 * reverted other edits, and a register password could land in it in plain text.
 */
export async function PUT() {
  return gone(
    "This endpoint was removed. Store details: PATCH …/stores/{store}. Features, integrations and time zone: PUT …/stores/{store}/settings. Register: PUT …/stores/{store}/pos-credentials."
  );
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(await deleteStore(admin, organizationId, storeId));
  } catch (error) {
    return jsonError(error);
  }
}
