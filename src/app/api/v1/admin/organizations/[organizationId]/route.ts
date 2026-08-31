import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { 
  OrganizationModel, 
  StoreModel, 
  SubscriptionModel, 
  WorkerInstallationModel, 
  SetupKeyModel, 
  AppUserModel 
} from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { organizationId } = await ctx.params;
    await requireInternalAdmin(req);
    await connectDb();
    const doc = await OrganizationModel.findOne({ organizationId }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ organization: safeJson(doc) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { organizationId } = await ctx.params;
    await requireInternalAdmin(req);
    await connectDb();
    
    const doc = await OrganizationModel.findOne({ organizationId });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cascade delete related records
    await StoreModel.deleteMany({ organizationId });
    await SubscriptionModel.deleteMany({ organizationId });
    await WorkerInstallationModel.deleteMany({ organizationId });
    await SetupKeyModel.deleteMany({ organizationId });
    await AppUserModel.deleteMany({ organizationId });
    
    // Finally delete the organization itself
    await OrganizationModel.deleteOne({ organizationId });

    return NextResponse.json({ success: true, deleted: organizationId });
  } catch (error) {
    return jsonError(error);
  }
}
