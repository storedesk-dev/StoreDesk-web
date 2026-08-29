import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { OrganizationModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

export async function GET(req: Request, { params }: { params: { organizationId: string } }) {
  try {
    await requireInternalAdmin(req);
    await connectDb();
    const doc = await OrganizationModel.findOne({ organizationId: params.organizationId }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ organization: safeJson(doc) });
  } catch (error) {
    return jsonError(error);
  }
}
