import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, writeAudit } from "@/lib/control-plane";
import {
  RoleListSchema,
  readOrganizationRoles,
  replaceOrganizationRoles,
  roleChangeReason
} from "@/lib/roles";
import { scheduleNotify } from "@/lib/store-notify";

type Ctx = { params: Promise<{ organizationId: string }> };

/** Every role of the organization, with `version` and `updatedAt` (defaults at version 1). */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const roles = await readOrganizationRoles(organizationId);
    if (!roles) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ roles });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Save the whole list (the admin UI's create, edit and delete all come through
 * here). Versions are computed against what is stored — an unchanged role keeps
 * its version, a changed one goes +1, a new one starts at 1 — and every store
 * server of the organization is notified to pull.
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { roles?: unknown } | null;

    if (!body || !Array.isArray(body.roles)) {
      return NextResponse.json({ error: "roles must be an array" }, { status: 400 });
    }
    const parsed = RoleListSchema.safeParse(body.roles);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `Invalid roles: ${where}${issue?.message ?? "bad shape"}` },
        { status: 400 }
      );
    }

    const result = await replaceOrganizationRoles(organizationId, parsed.data);
    if (!result) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (result.changed) {
      const reason = roleChangeReason(result);
      await writeAudit({
        organizationId,
        actorType: "internal_admin",
        actorId: admin.adminId,
        action: reason,
        targetType: "organization_roles",
        targetId: organizationId,
        metadata: { created: result.created, updated: result.updated, deleted: result.deleted }
      });
      scheduleNotify({ organizationId, reason });
    }

    return NextResponse.json({ roles: result.roles });
  } catch (error) {
    return jsonError(error);
  }
}
