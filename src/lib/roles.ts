import { z } from "zod";
import { connectDb } from "@/lib/db";
import { OrganizationModel } from "@/models/ControlPlane";
import { ControlPlaneError, canonicalJson } from "@/lib/control-plane-security";

/**
 * Organization roles: one list per organization in `Organization.roles`, held
 * in full (desktop and phone pages) by the control plane and by every store
 * server of the organization (docs/design/store-sign-in-and-sync.md).
 *
 * Every role carries `version` (starts at 1, +1 on every change) and
 * `updatedAt`. A stored role without a version reads as version 1, and an
 * organization with no stored roles has `DEFAULT_ORG_ROLES` at version 1.
 */

export const DEFAULT_ORG_ROLES = [
  {
    roleName: "Organization Admin",
    roleId: "org_admin",
    accessKeys: {
      electron: {
        pages: [
          { key: "pos",            enabled: true, featureFlags: { enableRefunds: true, enableDiscounts: true, enableVoidTransaction: true, enableCashDrawer: true } },
          { key: "dashboard",      enabled: true, featureFlags: {} },
          { key: "products",       enabled: true, featureFlags: { enableBulkImport: true, enableBarcodeGeneration: true } },
          { key: "vendors",        enabled: true, featureFlags: {} },
          { key: "priceBook",      enabled: true, featureFlags: { priceGroups: true } },
          { key: "costAnalysis",   enabled: true, featureFlags: {} },
          { key: "fuelPrices",     enabled: true, featureFlags: {} },
          { key: "deals",          enabled: true, featureFlags: {} },
          { key: "registerChanges", enabled: true, featureFlags: {} },
          { key: "transactions",   enabled: true, featureFlags: { enableExport: true, enableRefundView: true } },
          { key: "manageWorker",   enabled: true, featureFlags: {} },
          { key: "userManagement", enabled: true, featureFlags: {} },
          { key: "settings",       enabled: true, featureFlags: {} }
        ]
      },
      mobile: {
        pages: [
          { key: "mobilePos",           enabled: true, featureFlags: { enableManualEntry: true, enableQuickSale: true } },
          { key: "mobileDashboard",      enabled: true, featureFlags: {} },
          { key: "mobileScanner",        enabled: true, featureFlags: { enableCameraFlash: true, enableManualEntry: true } },
          { key: "mobileProductSearch",  enabled: true, featureFlags: {} },
          { key: "mobileVendorPrices",   enabled: true, featureFlags: {} },
          { key: "mobilePriceBook",      enabled: true, featureFlags: { priceGroups: true } },
          { key: "mobileFuelPrices",     enabled: true, featureFlags: {} },
          { key: "mobileDeals",          enabled: true, featureFlags: {} },
          { key: "mobileTransactions",   enabled: true, featureFlags: { enableExport: true } },
          { key: "mobileReports",        enabled: true, featureFlags: {} },
          { key: "mobileAnalytics",      enabled: true, featureFlags: {} },
          { key: "mobileSalesTax",       enabled: true, featureFlags: {} }
        ]
      }
    }
  }
];

export type RolePage = { key: string; enabled: boolean; featureFlags: Record<string, boolean> };
export type RoleAccessKeys = { electron: { pages: RolePage[] }; mobile: { pages: RolePage[] } };
export type OrgRole = {
  roleId: string;
  roleName: string;
  version: number;
  updatedAt: string;
  accessKeys: RoleAccessKeys;
};

const EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_PAGES_PER_APP = 200;
const MAX_ROLES = 100;

// ── Shape validation (edge PUT and admin PUT) ────────────────────────────────

const RolePageSchema = z.object({
  key: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  featureFlags: z.record(z.string(), z.boolean()).default({})
});

const AppPagesSchema = z
  .object({ pages: z.array(RolePageSchema).max(MAX_PAGES_PER_APP) })
  .refine((app) => new Set(app.pages.map((page) => page.key)).size === app.pages.length, {
    message: "Page keys must be unique within an app"
  });

export const RoleAccessKeysSchema = z.object({
  electron: AppPagesSchema.default({ pages: [] }),
  mobile: AppPagesSchema.default({ pages: [] })
});

const RoleNameSchema = z.string().trim().min(1).max(80);

/** `PUT /api/v1/edge/roles/{roleId}` body. */
export const EdgeRoleUpdateSchema = z.object({
  baseVersion: z.number().int().min(1),
  roleName: RoleNameSchema,
  accessKeys: RoleAccessKeysSchema
});
export type EdgeRoleUpdate = z.infer<typeof EdgeRoleUpdateSchema>;

/** One role as the admin UI sends it. Any `version`/`updatedAt` it echoes is ignored. */
export const RoleDefinitionSchema = z.object({
  roleId: z.string().trim().min(1).max(80),
  roleName: RoleNameSchema,
  accessKeys: RoleAccessKeysSchema
});
export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

export const RoleListSchema = z
  .array(RoleDefinitionSchema)
  .max(MAX_ROLES)
  .refine((roles) => new Set(roles.map((role) => role.roleId)).size === roles.length, {
    message: "Role ids must be unique"
  });

// ── Normalization ────────────────────────────────────────────────────────────

export function toIsoOr(value: unknown, fallback: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
}

function normalizePages(raw: unknown): RolePage[] {
  const pages = raw && typeof raw === "object" ? (raw as { pages?: unknown }).pages : undefined;
  if (!Array.isArray(pages)) return [];
  const result: RolePage[] = [];
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const { key, enabled, featureFlags } = page as Record<string, unknown>;
    if (typeof key !== "string" || !key.trim()) continue;
    const flags: Record<string, boolean> = {};
    if (featureFlags && typeof featureFlags === "object" && !Array.isArray(featureFlags)) {
      for (const [flag, value] of Object.entries(featureFlags)) {
        if (typeof value === "boolean") flags[flag] = value;
      }
    }
    result.push({ key: key.trim(), enabled: enabled === true, featureFlags: flags });
  }
  return result;
}

/** Always `{electron: {pages}, mobile: {pages}}`, pages reduced to key/enabled/boolean flags. */
export function normalizeAccessKeys(raw: unknown): RoleAccessKeys {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    electron: { pages: normalizePages(source.electron) },
    mobile: { pages: normalizePages(source.mobile) }
  };
}

/**
 * Stored roles (Mixed, possibly written by an older build) to the versioned
 * shape. No stored roles means the defaults. Missing version reads as 1;
 * missing `updatedAt` reads as `fallbackUpdatedAt` (the organization's
 * creation time), which keeps the access-sync hash stable.
 */
export function normalizeRoles(raw: unknown, fallbackUpdatedAt: string): OrgRole[] {
  const source: unknown[] = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_ORG_ROLES;
  const seen = new Set<string>();
  const roles: OrgRole[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const role = entry as Record<string, unknown>;
    if (typeof role.roleId !== "string" || !role.roleId.trim() || seen.has(role.roleId)) continue;
    seen.add(role.roleId);
    const version = role.version;
    roles.push({
      roleId: role.roleId,
      roleName:
        typeof role.roleName === "string" && role.roleName.trim() ? role.roleName : role.roleId,
      version: typeof version === "number" && Number.isInteger(version) && version >= 1 ? version : 1,
      updatedAt: toIsoOr(role.updatedAt, fallbackUpdatedAt),
      accessKeys: normalizeAccessKeys(role.accessKeys)
    });
  }
  return roles;
}

function roleContent(role: { roleName: string; accessKeys: RoleAccessKeys }): string {
  return canonicalJson({ roleName: role.roleName, accessKeys: role.accessKeys });
}

/**
 * The admin UI saves the whole list. Compare it with what is stored: an
 * unchanged role keeps its version and `updatedAt`, a changed one goes +1, a
 * new one starts at 1. Versions are always computed here, never taken from the
 * request.
 */
export function applyRoleVersions(previous: OrgRole[], next: RoleDefinition[], now: Date) {
  const before = new Map(previous.map((role) => [role.roleId, role]));
  const stamp = now.toISOString();
  const created: string[] = [];
  const updated: string[] = [];
  const roles: OrgRole[] = next.map((definition) => {
    const candidate = {
      roleId: definition.roleId,
      roleName: definition.roleName,
      accessKeys: normalizeAccessKeys(definition.accessKeys)
    };
    const old = before.get(definition.roleId);
    if (!old) {
      created.push(definition.roleId);
      return { ...candidate, version: 1, updatedAt: stamp };
    }
    if (roleContent(old) === roleContent(candidate)) return old;
    updated.push(definition.roleId);
    return { ...candidate, version: old.version + 1, updatedAt: stamp };
  });
  const kept = new Set(next.map((role) => role.roleId));
  const deleted = previous.filter((role) => !kept.has(role.roleId)).map((role) => role.roleId);
  return {
    roles,
    created,
    updated,
    deleted,
    // Includes a pure reorder, which changes the access-sync body.
    changed: canonicalJson(previous) !== canonicalJson(roles)
  };
}

export function roleChangeReason(change: {
  created: string[];
  updated: string[];
  deleted: string[];
}): "role.create" | "role.update" | "role.delete" {
  if (change.updated.length === 0 && change.deleted.length === 0 && change.created.length > 0) {
    return "role.create";
  }
  if (change.updated.length === 0 && change.created.length === 0 && change.deleted.length > 0) {
    return "role.delete";
  }
  return "role.update";
}

// ── Persistence ──────────────────────────────────────────────────────────────
// Two writers (the admin UI and store servers) edit the same array, so every
// write is compare-and-set on the organization's `updatedAt`: re-read, re-check
// the version, write only if nobody wrote in between. Versions stay monotonic.

const WRITE_ATTEMPTS = 4;

type OrganizationRecord = Record<string, unknown> & { roles?: unknown; updatedAt?: unknown };

async function loadOrganization(organizationId: string): Promise<OrganizationRecord | null> {
  await connectDb();
  return (await OrganizationModel.findOne({ organizationId }).lean()) as OrganizationRecord | null;
}

function storedRoles(org: OrganizationRecord): OrgRole[] {
  return normalizeRoles(org.roles, toIsoOr(org.createdAt, EPOCH));
}

async function compareAndSetRoles(
  organizationId: string,
  stamp: unknown,
  roles: OrgRole[]
): Promise<boolean> {
  const written = await OrganizationModel.findOneAndUpdate(
    { organizationId, updatedAt: stamp ?? null },
    { $set: { roles } },
    { returnDocument: "after" }
  ).lean();
  return Boolean(written);
}

function busy(): ControlPlaneError {
  return new ControlPlaneError(503, "ROLES_BUSY", "Roles changed while saving; try again", true);
}

export async function readOrganizationRoles(organizationId: string): Promise<OrgRole[] | null> {
  const org = await loadOrganization(organizationId);
  return org ? storedRoles(org) : null;
}

/** Admin save of the whole list. `null` when the organization does not exist. */
export async function replaceOrganizationRoles(organizationId: string, next: RoleDefinition[]) {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const org = await loadOrganization(organizationId);
    if (!org) return null;
    const result = applyRoleVersions(storedRoles(org), next, new Date());
    if (!result.changed) return result;
    if (await compareAndSetRoles(organizationId, org.updatedAt, result.roles)) return result;
  }
  throw busy();
}

export type EdgeRoleUpdateOutcome =
  | { status: "ok"; role: OrgRole }
  | { status: "conflict"; role: OrgRole }
  | { status: "not_found" };

// ── One role at a time (admin UI, P3) ────────────────────────────────────────

export const ROLE_ID = /^[a-z][a-z0-9_]{0,39}$/;

/** `PUT /api/v1/admin/organizations/{org}/roles/{roleId}` — same shape as the edge route. */
export const AdminRoleUpdateSchema = EdgeRoleUpdateSchema;

/**
 * Admin saves may only name pages the apps have, each under its own app (the
 * editors list the registry; P10). The edge route stays lenient: a store
 * server running a newer registry may know a page this build does not.
 */
export function unknownPageKeys(
  accessKeys: RoleAccessKeys,
  registry: Array<{ key: string; app: "electron" | "mobile" }>
): string[] {
  const known = new Set(registry.map((page) => `${page.app}:${page.key}`));
  const unknown: string[] = [];
  for (const app of ["electron", "mobile"] as const) {
    for (const page of accessKeys[app].pages) {
      if (!known.has(`${app}:${page.key}`)) unknown.push(`${app}.${page.key}`);
    }
  }
  return unknown;
}

export type RoleCreateOutcome = { status: "ok"; role: OrgRole } | { status: "exists" } | { status: "not_found" };

export async function createRole(
  organizationId: string,
  input: { roleId: string; roleName: string; accessKeys: RoleAccessKeys }
): Promise<RoleCreateOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const org = await loadOrganization(organizationId);
    if (!org) return { status: "not_found" };
    const roles = storedRoles(org);
    if (roles.some((role) => role.roleId === input.roleId)) return { status: "exists" };
    if (roles.length >= MAX_ROLES) {
      throw new ControlPlaneError(409, "ROLE_LIMIT_REACHED", `An organization can have at most ${MAX_ROLES} roles`);
    }
    const role: OrgRole = {
      roleId: input.roleId,
      roleName: input.roleName,
      accessKeys: normalizeAccessKeys(input.accessKeys),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    if (await compareAndSetRoles(organizationId, org.updatedAt, [...roles, role])) {
      return { status: "ok", role };
    }
  }
  throw busy();
}

export type RoleDeleteOutcome = { status: "ok"; role: OrgRole } | { status: "not_found" };

export async function deleteRole(organizationId: string, roleId: string): Promise<RoleDeleteOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const org = await loadOrganization(organizationId);
    if (!org) return { status: "not_found" };
    const roles = storedRoles(org);
    const role = roles.find((entry) => entry.roleId === roleId);
    if (!role) return { status: "not_found" };
    if (await compareAndSetRoles(organizationId, org.updatedAt, roles.filter((entry) => entry.roleId !== roleId))) {
      return { status: "ok", role };
    }
  }
  throw busy();
}

/** Store the given roles as they are (a new organization's templates). */
export async function writeInitialRoles(organizationId: string, roles: OrgRole[]): Promise<void> {
  await connectDb();
  await OrganizationModel.updateOne({ organizationId }, { $set: { roles } });
}

/**
 * Save one role, accepted only on top of the stored version — for a store
 * server (`PUT /api/v1/edge/roles/{roleId}`) and the admin UI alike.
 */
export async function updateRole(
  organizationId: string,
  roleId: string,
  update: EdgeRoleUpdate
): Promise<EdgeRoleUpdateOutcome> {
  return updateRoleFromEdge(organizationId, roleId, update);
}

/** A store server's edit of one role, accepted only on top of the stored version. */
export async function updateRoleFromEdge(
  organizationId: string,
  roleId: string,
  update: EdgeRoleUpdate
): Promise<EdgeRoleUpdateOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const org = await loadOrganization(organizationId);
    if (!org) return { status: "not_found" };
    const roles = storedRoles(org);
    const index = roles.findIndex((role) => role.roleId === roleId);
    if (index < 0) return { status: "not_found" };
    const current = roles[index];
    if (current.version !== update.baseVersion) return { status: "conflict", role: current };
    const role: OrgRole = {
      roleId,
      roleName: update.roleName,
      accessKeys: normalizeAccessKeys(update.accessKeys),
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    const next = roles.slice();
    next[index] = role;
    if (await compareAndSetRoles(organizationId, org.updatedAt, next)) {
      return { status: "ok", role };
    }
  }
  throw busy();
}
