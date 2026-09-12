import { AuditEventModel } from "@/models/ControlPlane";
import { publicId, safeJson } from "@/lib/control-plane-security";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Every mutation writes one audit event. Metadata goes through safeJson, so a
 * field named like a secret is dropped even if a caller passes one by mistake.
 */

export type AuditInput = {
  organizationId?: string;
  storeId?: string;
  workerInstallationId?: string;
  actorType: "internal_admin" | "app_user" | "worker" | "system";
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await AuditEventModel.create({
    auditEventId: publicId("aud"),
    organizationId: input.organizationId || "org_system",
    storeId: input.storeId,
    workerInstallationId: input.workerInstallationId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    correlationId: input.correlationId || publicId("corr"),
    metadata: safeJson(input.metadata || {}),
    occurredAt: new Date()
  });
}

/** An admin action: the actor is the signed-in staff member. */
export function auditAdmin(
  admin: InternalAdminActor,
  input: Omit<AuditInput, "actorType" | "actorId">
): Promise<void> {
  return writeAudit({ ...input, actorType: "internal_admin", actorId: admin.adminId });
}
