import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { auditAdmin } from "@/lib/audit";
import { jsonError, notFound, parseBody } from "@/lib/http";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { ALL_PAGES } from "@/config/pages";
import { UserAssignmentModel } from "@/models/ControlPlane";
import { AdminRoleUpdateSchema, deleteRole, unknownPageKeys, updateRole } from "@/lib/roles";
import { requireStore } from "@/lib/tenant-stores";
import { scheduleNotify } from "@/lib/store-notify";

type Ctx = { params: Promise<{ storeId: string; roleId: string }> };

/**
 * Save one role on top of the version the editor read (P3): `{baseVersion,
 * roleName, accessKeys}`. 200 `{role}` at version + 1; 409
 * ROLE_VERSION_CONFLICT with the current `role` when someone (a store server
 * too) saved in between. The store is notified.
 */
export async function PUT(req: Request, ctx: Ctx) {
  const correlationId = publicId("corr");
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId, roleId } = await ctx.params;
    const body = await parseBody(req, AdminRoleUpdateSchema);
    const outcome = await updateRole(storeId, roleId, body);
    if (outcome.status === "not_found") {
      throw new ControlPlaneError(404, "ROLE_NOT_FOUND", "Role not found");
    }
    if (outcome.status === "conflict") {
      throw new ControlPlaneError(
        409,
        "ROLE_VERSION_CONFLICT",
        "This role changed since you opened it (maybe on a store PC). Review the current version and save again.",
        false,
        { role: outcome.role }
      );
    }
    await auditAdmin(admin, {
      storeId,
      action: "role.update",
      targetType: "role",
      targetId: roleId,
      correlationId,
      metadata: { baseVersion: body.baseVersion, version: outcome.role.version, roleName: body.roleName }
    });
    scheduleNotify({ storeId, reason: "role.update" });
    const unknown = unknownPageKeys(outcome.role.accessKeys, ALL_PAGES);
    return NextResponse.json({
      role: outcome.role,
      ...(unknown.length ? { warnings: { unknownPageKeys: unknown } } : {})
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

/** Delete a role; 409 ROLE_IN_USE while any active assignment names it. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId, roleId } = await ctx.params;
    await requireStore(storeId);
    const users = await UserAssignmentModel.distinct("appUserId", { storeId, role: roleId, status: "active" });
    if (users.length) {
      throw new ControlPlaneError(
        409,
        "ROLE_IN_USE",
        `${users.length} user${users.length === 1 ? " has" : "s have"} this role; give them another role first`,
        false,
        { userCount: users.length }
      );
    }
    const outcome = await deleteRole(storeId, roleId);
    if (outcome.status === "not_found") throw notFound("Role");
    await auditAdmin(admin, {
      storeId,
      action: "role.delete",
      targetType: "role",
      targetId: roleId,
      metadata: { roleName: outcome.role.roleName, version: outcome.role.version }
    });
    scheduleNotify({ storeId, reason: "role.delete" });
    return NextResponse.json({ deleted: roleId });
  } catch (error) {
    return jsonError(error);
  }
}
