import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    
    await connectDb();
    
    const store = await TenantStoreModel.findOne({ organizationId, storeId });
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Clear tunnel configuration
    store.tunnelUrl = undefined;
    store.cloudflareToken = undefined;
    await store.save();

    return NextResponse.json({ store: safeJson(store) });
  } catch (error) {
    return jsonError(error);
  }
}
