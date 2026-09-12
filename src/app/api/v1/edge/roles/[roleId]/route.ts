import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError, writeAudit } from "@/lib/control-plane";
import { ControlPlaneError, enforceRateLimit, publicId } from "@/lib/control-plane-security";
import { EdgeRoleUpdateSchema, updateRoleFromEdge } from "@/lib/roles";
import { scheduleNotify } from "@/lib/store-notify";

type Ctx = { params: Promise<{ roleId: string }> };

/**
 * A role edited on a store server (docs/design/store-sign-in-and-sync.md).
 * Accepted only on top of the stored version: 200 with version + 1, or 409
 * ROLE_VERSION_CONFLICT with the current role (the control plane wins and the
 * store pulls). Roles are organization-wide, so every OTHER installation of
 * the organization is then notified.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const correlationId = publicId("corr");
  try {
    const worker = await authenticateWorker(req);
    enforceRateLimit(`edge-role:${worker.workerInstallationId}`, { limit: 30, windowMs: 60_000 });
    const { roleId } = await ctx.params;

    const raw = await req.json().catch(() => undefined);
    const parsed = EdgeRoleUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      throw new ControlPlaneError(400, "REQUEST_INVALID", `${where}${issue?.message ?? "Invalid role"}`);
    }

    const outcome = await updateRoleFromEdge(worker.organizationId, roleId, parsed.data);
    if (outcome.status === "not_found") {
      throw new ControlPlaneError(404, "ROLE_NOT_FOUND", "Role not found");
    }
    if (outcome.status === "conflict") {
      return NextResponse.json(
        {
          error: {
            code: "ROLE_VERSION_CONFLICT",
            message: "The role changed in the control plane; pull and try again",
            correlationId,
            retryable: false
          },
          role: outcome.role
        },
        { status: 409 }
      );
    }

    await writeAudit({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId,
      actorType: "worker",
      actorId: worker.workerInstallationId,
      action: "role.update",
      targetType: "role",
      targetId: roleId,
      correlationId,
      metadata: { baseVersion: parsed.data.baseVersion, version: outcome.role.version }
    });
    scheduleNotify({
      organizationId: worker.organizationId,
      exceptInstallationId: worker.workerInstallationId,
      reason: "role.update"
    });

    return NextResponse.json({ role: outcome.role });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
