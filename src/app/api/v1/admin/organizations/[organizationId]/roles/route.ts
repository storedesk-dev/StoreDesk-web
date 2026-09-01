import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { DEFAULT_ORG_ROLES, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { OrganizationModel } from "@/models/ControlPlane";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await connectDb();

    const org = await OrganizationModel.findOne({ organizationId }).lean();
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const roles = Array.isArray((org as Record<string, unknown>).roles) && ((org as Record<string, unknown>).roles as unknown[]).length > 0
      ? (org as Record<string, unknown>).roles
      : DEFAULT_ORG_ROLES;

    return NextResponse.json({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await req.json();

    if (!body || !Array.isArray(body.roles)) {
      return NextResponse.json({ error: "roles must be an array" }, { status: 400 });
    }

    await connectDb();
    const org = await OrganizationModel.findOneAndUpdate(
      { organizationId },
      { $set: { roles: body.roles } },
      { new: true }
    ).lean();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ roles: (org as Record<string, unknown>).roles });
  } catch (error) {
    return jsonError(error);
  }
}
