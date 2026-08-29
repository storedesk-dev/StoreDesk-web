import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { AppUserModel, UserAssignmentModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await connectDb();

    // Get all assignments for this org
    const assignments = await UserAssignmentModel.find({ organizationId, status: "active" }).lean();
    const appUserIds = [...new Set(assignments.map(a => a.appUserId))];

    // Hydrate users
    const users = await AppUserModel.find({ appUserId: { $in: appUserIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Join assignment data
    const result = users.map(u => ({
      ...safeJson(u),
      assignments: assignments.filter(a => String(a.appUserId) === String(u.appUserId))
    }));

    return NextResponse.json({ appUsers: result });
  } catch (error) {
    return jsonError(error);
  }
}
