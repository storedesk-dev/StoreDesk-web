import { z } from "zod";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { templateRoles } from "@/lib/role-templates";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { ALL_PAGES, type App } from "@/config/pages";

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
          { key: "settings",       enabled: true, featureFlags: { reportMapping: true } }
        ]
      },
      mobile: {
        pages: [
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
          { key: "mobileSalesTax",       enabled: true, featureFlags: {} },
          { key: "mobileSettings",       enabled: true, featureFlags: {} }
        ]
      }
    }
  }
];

export type RolePage = { key: string; enabled: boolean; featureFlags: Record<string, boolean> };
/**
 * One block per app. StoreDesk Lottery is its own: separate installer, separate PC.
 *
 * `lottery` is optional because every role stored before that app existed has no such block, and a
 * reader must cope with that rather than crash on it. Everything written here fills it in.
 */
export type RoleAccessKeys = {
  electron: { pages: RolePage[] };
  mobile: { pages: RolePage[] };
  lottery?: { pages: RolePage[] };
};
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
  mobile: AppPagesSchema.default({ pages: [] }),
  // Roles saved before StoreDesk Lottery existed carry no block at all, and a save from an older
  // build still sends none. Optional, not defaulted, so the type says so — and nobody gains a
  // lottery page by an app being added.
  lottery: AppPagesSchema.optional()
});

const RoleNameSchema = z.string().trim().min(1).max(80);

/** `PUT /api/v1/edge/roles/{roleId}` body. */
export const EdgeRoleUpdateSchema = z.object({
  baseVersion: z.number().int().min(1),
  roleName: RoleNameSchema,
  accessKeys: RoleAccessKeysSchema
});
export type EdgeRoleUpdate = z.infer<typeof EdgeRoleUpdateSchema>;

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
    mobile: { pages: normalizePages(source.mobile) },
    lottery: { pages: normalizePages(source.lottery) }
  };
}

// ── Organization Admin: every page, always ───────────────────────────────────

/** The role that always has every page and every feature flag of both apps. */
export const ORG_ADMIN_ROLE_ID = "org_admin";

const APPS = ["electron", "mobile", "lottery"] as const;

/**
 * Every registered page of both apps, enabled, with every known flag true:
 * what the Organization Admin role resolves to. Stored flags the registry does
 * not know are kept; stored pages the registry does not offer (retired, or
 * named by a newer store build) are kept as stored, after the registry's.
 */
export function orgAdminAccessKeys(stored: RoleAccessKeys): RoleAccessKeys {
  const build = (app: (typeof APPS)[number]): RolePage[] => {
    const byKey = new Map((stored[app]?.pages ?? []).map((page) => [page.key, page]));
    const offered = ALL_PAGES.filter((page) => page.app === app && !page.retired);
    const full = offered.map((def) => {
      const featureFlags: Record<string, boolean> = { ...(byKey.get(def.key)?.featureFlags ?? {}) };
      for (const flag of Object.keys(def.knownFeatureFlags)) featureFlags[flag] = true;
      return { key: def.key, enabled: true, featureFlags };
    });
    const offeredKeys = new Set(offered.map((page) => page.key));
    return [...full, ...(stored[app]?.pages ?? []).filter((page) => !offeredKeys.has(page.key))];
  };
  return { electron: { pages: build("electron") }, mobile: { pages: build("mobile") }, lottery: { pages: build("lottery") } };
}

/** Access keys compared regardless of page and flag order. */
function sameAccess(a: RoleAccessKeys, b: RoleAccessKeys): boolean {
  const canon = (keys: RoleAccessKeys) =>
    JSON.stringify(
      APPS.map((app) =>
        [...(keys[app]?.pages ?? [])]
          .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
          .map((page) => [
            page.key,
            page.enabled,
            Object.keys(page.featureFlags)
              .sort()
              .map((flag) => [flag, page.featureFlags[flag]])
          ])
      )
    );
  return canon(a) === canon(b);
}

/**
 * The Organization Admin role with every registered page and flag. When that
 * differs from what is stored (a page or flag added since it was saved), the
 * role reads one version higher, so every store takes the new pages at its
 * next sync; `changed` says so. Any other role is returned as it is: new pages
 * are never granted to it automatically (the admin console lists them).
 */
export function resolveOrgAdminRole(role: OrgRole): { role: OrgRole; changed: boolean } {
  if (role.roleId !== ORG_ADMIN_ROLE_ID) return { role, changed: false };
  const accessKeys = orgAdminAccessKeys(role.accessKeys);
  if (sameAccess(accessKeys, role.accessKeys)) return { role, changed: false };
  return { role: { ...role, version: role.version + 1, accessKeys }, changed: true };
}

/**
 * Stored roles (Mixed, possibly written by an older build) to the versioned
 * shape. No stored roles means the defaults. Missing version reads as 1;
 * missing `updatedAt` reads as `fallbackUpdatedAt` (the organization's
 * creation time), which keeps the access-sync hash stable.
 *
 * The Organization Admin role always reads with every registered page and flag
 * (resolveOrgAdminRole); a stored copy missing some reads at its version + 1.
 * The defaults are not stored, so they read at version 1 either way.
 */
export function normalizeRoles(raw: unknown, fallbackUpdatedAt: string): OrgRole[] {
  const stored = Array.isArray(raw) && raw.length > 0;
  const source: unknown[] = stored ? (raw as unknown[]) : DEFAULT_ORG_ROLES;
  const seen = new Set<string>();
  const roles: OrgRole[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const role = entry as Record<string, unknown>;
    if (typeof role.roleId !== "string" || !role.roleId.trim() || seen.has(role.roleId)) continue;
    seen.add(role.roleId);
    const version = role.version;
    const normalized: OrgRole = {
      roleId: role.roleId,
      roleName:
        typeof role.roleName === "string" && role.roleName.trim() ? role.roleName : role.roleId,
      version: typeof version === "number" && Number.isInteger(version) && version >= 1 ? version : 1,
      updatedAt: toIsoOr(role.updatedAt, fallbackUpdatedAt),
      accessKeys: normalizeAccessKeys(role.accessKeys)
    };
    const resolved = resolveOrgAdminRole(normalized).role;
    roles.push(stored ? resolved : { ...resolved, version: normalized.version });
  }
  return roles;
}

/** The stored Organization Admin role lacks a registered page or flag: the stored copy is behind. */
export function orgAdminRoleOutdated(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  const entry = raw.find(
    (role) => Boolean(role) && typeof role === "object" && (role as Record<string, unknown>).roleId === ORG_ADMIN_ROLE_ID
  ) as Record<string, unknown> | undefined;
  if (!entry) return false;
  const accessKeys = normalizeAccessKeys(entry.accessKeys);
  return !sameAccess(orgAdminAccessKeys(accessKeys), accessKeys);
}

// ── Persistence ──────────────────────────────────────────────────────────────
// Two writers (the admin UI and store servers) edit the same array, so every
// write is compare-and-set on the organization's `updatedAt`: re-read, re-check
// the version, write only if nobody wrote in between. Versions stay monotonic.

const WRITE_ATTEMPTS = 4;

/** A store document, as far as its roles are concerned. */
export type StoreRecord = Record<string, unknown> & { roles?: unknown; updatedAt?: unknown };

async function loadStoreRecord(storeId: string): Promise<StoreRecord | null> {
  await connectDb();
  return (await TenantStoreModel.findOne({ storeId }).lean()) as StoreRecord | null;
}

/**
 * A store with no roles of its own gets the four templates.
 *
 * That is the answer, not a stopgap: every store is created with them, and a store that somehow
 * has none would otherwise let nobody in at all. `normalizeRoles` keeps whatever is stored.
 */
function storedRoles(store: StoreRecord): OrgRole[] {
  const stamp = toIsoOr(store.createdAt, EPOCH);
  const stored = normalizeRoles(store.roles, stamp);
  return stored.length ? stored : templateRoles(new Date(stamp));
}

async function compareAndSetRoles(storeId: string, stamp: unknown, roles: OrgRole[]): Promise<boolean> {
  const written = await TenantStoreModel.findOneAndUpdate(
    { storeId, updatedAt: stamp ?? null },
    { $set: { roles } },
    { returnDocument: "after" }
  ).lean();
  return Boolean(written);
}

function busy(): ControlPlaneError {
  return new ControlPlaneError(503, "ROLES_BUSY", "Roles changed while saving; try again", true);
}

/**
 * The store's roles as read, first storing the Organization Admin role with the pages it reads
 * with (at the version it reads at) when the stored copy is behind the registry. Best effort: a
 * lost compare-and-set leaves it for the next read, and every read resolves it the same way
 * meanwhile, so the version a store sees never goes back.
 */
export async function rolesPersistingOrgAdmin(storeId: string, store: StoreRecord): Promise<OrgRole[]> {
  const roles = storedRoles(store);
  if (orgAdminRoleOutdated(store.roles)) {
    await compareAndSetRoles(storeId, store.updatedAt, roles).catch(() => false);
  }
  return roles;
}

export async function readStoreRoles(storeId: string): Promise<OrgRole[] | null> {
  const store = await loadStoreRecord(storeId);
  return store ? rolesPersistingOrgAdmin(storeId, store) : null;
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
  registry: Array<{ key: string; app: App }>
): string[] {
  const known = new Set(registry.map((page) => `${page.app}:${page.key}`));
  const unknown: string[] = [];
  for (const app of APPS) {
    for (const page of accessKeys[app]?.pages ?? []) {
      if (!known.has(`${app}:${page.key}`)) unknown.push(`${app}.${page.key}`);
    }
  }
  return unknown;
}

function accessKeysToStore(roleId: string, accessKeys: RoleAccessKeys): RoleAccessKeys {
  const normalized = normalizeAccessKeys(accessKeys);
  return roleId === ORG_ADMIN_ROLE_ID ? orgAdminAccessKeys(normalized) : normalized;
}

export type RoleCreateOutcome = { status: "ok"; role: OrgRole } | { status: "exists" } | { status: "not_found" };

export async function createRole(
  storeId: string,
  input: { roleId: string; roleName: string; accessKeys: RoleAccessKeys }
): Promise<RoleCreateOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const store = await loadStoreRecord(storeId);
    if (!store) return { status: "not_found" };
    const roles = storedRoles(store);
    if (roles.some((role) => role.roleId === input.roleId)) return { status: "exists" };
    if (roles.length >= MAX_ROLES) {
      throw new ControlPlaneError(409, "ROLE_LIMIT_REACHED", `A store can have at most ${MAX_ROLES} roles`);
    }
    const role: OrgRole = {
      roleId: input.roleId,
      roleName: input.roleName,
      accessKeys: accessKeysToStore(input.roleId, input.accessKeys),
      version: 1,
      updatedAt: new Date().toISOString()
    };
    if (await compareAndSetRoles(storeId, store.updatedAt, [...roles, role])) {
      return { status: "ok", role };
    }
  }
  throw busy();
}

export type RoleDeleteOutcome = { status: "ok"; role: OrgRole } | { status: "not_found" };

export async function deleteRole(storeId: string, roleId: string): Promise<RoleDeleteOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const store = await loadStoreRecord(storeId);
    if (!store) return { status: "not_found" };
    const roles = storedRoles(store);
    const role = roles.find((entry) => entry.roleId === roleId);
    if (!role) return { status: "not_found" };
    if (await compareAndSetRoles(storeId, store.updatedAt, roles.filter((entry) => entry.roleId !== roleId))) {
      return { status: "ok", role };
    }
  }
  throw busy();
}

/** Store the given roles as they are (a new organization's templates). */
export async function writeInitialRoles(storeId: string, roles: OrgRole[]): Promise<void> {
  await connectDb();
  await TenantStoreModel.updateOne({ storeId }, { $set: { roles } });
}

/**
 * Save one role, accepted only on top of the stored version — for a store
 * server (`PUT /api/v1/edge/roles/{roleId}`) and the admin UI alike.
 */
export async function updateRole(
  storeId: string,
  roleId: string,
  update: EdgeRoleUpdate
): Promise<EdgeRoleUpdateOutcome> {
  return updateRoleFromEdge(storeId, roleId, update);
}

/** A store server's edit of one role, accepted only on top of the stored version. */
export async function updateRoleFromEdge(
  storeId: string,
  roleId: string,
  update: EdgeRoleUpdate
): Promise<EdgeRoleUpdateOutcome> {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const store = await loadStoreRecord(storeId);
    if (!store) return { status: "not_found" };
    const roles = storedRoles(store);
    const index = roles.findIndex((role) => role.roleId === roleId);
    if (index < 0) return { status: "not_found" };
    const current = roles[index];
    if (current.version !== update.baseVersion) return { status: "conflict", role: current };
    const role: OrgRole = {
      roleId,
      roleName: update.roleName,
      // The Organization Admin keeps every page whatever an edit sends.
      accessKeys: accessKeysToStore(roleId, update.accessKeys),
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    const next = roles.slice();
    next[index] = role;
    if (await compareAndSetRoles(storeId, store.updatedAt, next)) {
      return { status: "ok", role };
    }
  }
  throw busy();
}
