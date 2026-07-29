import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { getBootstrap, jsonError } from "@/lib/control-plane";
import { ControlPlaneError } from "@/lib/control-plane-security";

type Ctx = {
  params: Promise<{ organizationId: string; storeId: string; workerInstallationId: string }>;
};

export async function GET(req: Request, ctx: Ctx) {
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
    const bootstrap = await getBootstrap(organizationId, storeId, workerInstallationId);
    return NextResponse.json(bootstrap);
  } catch (error) {
    return jsonError(error);
  }
}
