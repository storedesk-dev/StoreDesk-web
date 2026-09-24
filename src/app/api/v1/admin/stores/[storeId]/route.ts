import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { StorePatchSchema, deleteStore, getStoreDetail, updateStore } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ storeId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await getStoreDetail(storeId));
  } catch (error) {
    return jsonError(error);
  }
}

/** Name, number, address, contact e-mail, status (active | suspended | closed). */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    const body = await parseBody(req, StorePatchSchema);
    return NextResponse.json({ store: await updateStore(admin, storeId, body) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await deleteStore(admin, storeId));
  } catch (error) {
    return jsonError(error);
  }
}
