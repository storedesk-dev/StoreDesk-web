import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { OrganizationModel } from "@/models/ControlPlane";
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
