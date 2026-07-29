import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createAssignment, jsonError } from "@/lib/control-plane";

type Ctx = { params: Promise<{ appUserId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { appUserId } = await ctx.params;
    const body = (await req.json()) as {
      organizationId?: string;
      storeId?: string;
      workerInstallationId?: string;
      role?: "store_operator" | "store_manager" | "viewer";
      scopes?: string[];
    };
    if (!body.organizationId || !body.storeId || !body.workerInstallationId || !body.role) {
      return NextResponse.json(
        { error: "organizationId, storeId, workerInstallationId, and role are required" },
        { status: 400 }
      );
    }
    const assignment = await createAssignment(admin, appUserId, {
      organizationId: body.organizationId,
      storeId: body.storeId,
      workerInstallationId: body.workerInstallationId,
      role: body.role,
      scopes: body.scopes
    });
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
