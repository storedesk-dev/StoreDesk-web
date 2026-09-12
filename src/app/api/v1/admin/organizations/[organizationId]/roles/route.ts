import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { auditAdmin } from "@/lib/audit";
import { jsonError, notFound, parseBody } from "@/lib/http";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { ALL_PAGES } from "@/config/pages";
import { UserAssignmentModel } from "@/models/ControlPlane";
import { ROLE_ID, RoleAccessKeysSchema, createRole, readOrganizationRoles, unknownPageKeys } from "@/lib/roles";
import { TEMPLATE_IDS, templateAccessKeys, templateSummaries } from "@/lib/role-templates";
import { scheduleNotify } from "@/lib/store-notify";

type Ctx = { params: Promise<{ organizationId: string }> };

async function userCounts(organizationId: string): Promise<Map<string, number>> {
  const rows = (await UserAssignmentModel.aggregate([
    { $match: { organizationId, status: "active" } },
    { $group: { _id: { role: "$role", user: "$appUserId" } } },
    { $group: { _id: "$_id.role", count: { $sum: 1 } } }
  ])) as Array<{ _id: string; count: number }>;
  return new Map(rows.map((row) => [row._id, row.count]));
}

/**
 * Every role (defaults at version 1 when none are stored), with its user
 * count, and the templates. Roles are saved one at a time
 * (`PUT …/roles/{roleId}` with `baseVersion`); there is no whole-list save.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const roles = await readOrganizationRoles(organizationId);
    if (!roles) throw notFound("Organization");
    const counts = await userCounts(organizationId);
    return NextResponse.json({
      roles: roles.map((role) => ({ ...role, userCount: counts.get(role.roleId) ?? 0 })),
      templates: templateSummaries()
    });
  } catch (error) {
    return jsonError(error);
  }
}

const RoleCreateSchema = z
  .object({
    roleId: z.string().trim().regex(ROLE_ID, "roleId: lower-case letters, digits and _, starting with a letter").optional(),
    roleName: z.string().trim().min(1).max(80),
    /** `templateId` is accepted as another name for it. */
    template: z.enum(TEMPLATE_IDS).optional(),
    templateId: z.enum(TEMPLATE_IDS).optional(),
    accessKeys: RoleAccessKeysSchema.optional()
  })
  .strict();

function roleIdFrom(name: string, taken: Set<string>): string {
  let base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  if (!/^[a-z]/.test(base)) base = `role_${base}`.replace(/_+$/, "");
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}_${n}`;
  return id;
}

/**
 * Create one role: `{roleName, roleId?, template?, accessKeys?}`. The access
 * comes from `accessKeys` when given, else the template (default blank). The
 * id is derived from the name when not given; 409 ROLE_EXISTS for a taken id.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, RoleCreateSchema);
    const existing = await readOrganizationRoles(organizationId);
    if (!existing) throw notFound("Organization");
    const roleId = body.roleId ?? roleIdFrom(body.roleName, new Set(existing.map((role) => role.roleId)));
    const template = body.template ?? body.templateId ?? "blank";
    const accessKeys = body.accessKeys ?? templateAccessKeys(template);
    const outcome = await createRole(organizationId, { roleId, roleName: body.roleName, accessKeys });
    if (outcome.status === "not_found") throw notFound("Organization");
    if (outcome.status === "exists") {
      throw new ControlPlaneError(409, "ROLE_EXISTS", `A role with the id "${roleId}" already exists`);
    }
    await auditAdmin(admin, {
      organizationId,
      action: "role.create",
      targetType: "role",
      targetId: roleId,
      metadata: { roleName: body.roleName, template: body.accessKeys ? null : template }
    });
    scheduleNotify({ organizationId, reason: "role.create" });
    const unknown = unknownPageKeys(outcome.role.accessKeys, ALL_PAGES);
    return NextResponse.json(
      { role: { ...outcome.role, userCount: 0 }, ...(unknown.length ? { warnings: { unknownPageKeys: unknown } } : {}) },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
