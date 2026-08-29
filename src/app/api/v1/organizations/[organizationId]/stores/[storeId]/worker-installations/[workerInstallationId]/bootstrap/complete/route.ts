import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { completeBootstrap, jsonError } from "@/lib/control-plane";
import { ControlPlaneError } from "@/lib/control-plane-security";

type Ctx = {
  params: Promise<{ organizationId: string; storeId: string; workerInstallationId: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  try {
    const worker = await authenticateWorker(req);
    const { organizationId, storeId, workerInstallationId } = await ctx.params;
    if (
      worker.organizationId !== organizationId ||
      worker.storeId !== storeId ||
      worker.workerInstallationId !== workerInstallationId
    ) {
      throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Resource not found");
    }
        const body = (await req.json()) as { bootstrapVersion?: string; lanUrl?: string };
    const result = await completeBootstrap(organizationId, storeId, workerInstallationId, {
      bootstrapVersion: body.bootstrapVersion || "1",
      lanUrl: body.lanUrl
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
