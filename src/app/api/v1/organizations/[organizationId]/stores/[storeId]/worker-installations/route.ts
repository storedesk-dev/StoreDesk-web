import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createWorkerInstallation, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { WorkerInstallationModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    await connectDb();
    const installations = await WorkerInstallationModel.find({ organizationId, storeId }).lean();
    return NextResponse.json({ workerInstallations: safeJson(installations) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = (await req.json()) as {
      subscriptionId?: string;
      workerName?: string;
      contactEmail?: string;
      storeNumber?: string;
      address?: string;
    };
    if (!body.workerName?.trim() || !body.contactEmail?.trim()) {
      return NextResponse.json(
        { error: "workerName and contactEmail are required" },
        { status: 400 }
      );
    }
    const installation = await createWorkerInstallation(admin, organizationId, storeId, {
      subscriptionId: body.subscriptionId,
      workerName: body.workerName,
      contactEmail: body.contactEmail,
      storeNumber: body.storeNumber,
      address: body.address
    });
    return NextResponse.json({ workerInstallation: installation }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
