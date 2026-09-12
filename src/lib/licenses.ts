import { randomInt } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { LicenseModel, OrganizationModel, TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { scheduleNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Licenses (docs/design/control-plane-admin.md, "Licenses").
 *
 * - An organization license covers any of the organization's stores up to its
 *   seats (`maxStores`); at most one non-cancelled per organization.
 * - A store license covers exactly one store; at most one non-cancelled per store.
 * - Every store has one covering license (`TenantStore.licenseId`) or none
 *   ("Unlicensed"). Activation, the access sync's `subscription` block and
 *   every entitlement check use it.
 *
 * "One non-cancelled per scope" is enforced by a unique partial index on
 * `coverageKey`, which is set while a license is not cancelled.
 */

type Doc = Record<string, unknown>;
export type LicenseScope = "organization" | "store";

export const ENTITLED_STATUSES = ["trialing", "active"];
export const LICENSE_STATUSES = ["trialing", "active", "suspended", "cancelled", "expired"] as const;
const DAY_MS = 86_400_000;
const DEFAULT_SEATS = 5;
const DEFAULT_PCS = 1;
const DEFAULT_GRACE = 7;

// ── License numbers ──────────────────────────────────────────────────────────

/** Crockford base32: no I, L, O or U, so a number read aloud or typed is never ambiguous. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LICENSE_NUMBER = /^SD-(ORG|STR)-[0-9A-HJKMNP-TV-Z]{6}$/;

export function newLicenseNumber(scope: LicenseScope): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += CROCKFORD[randomInt(CROCKFORD.length)];
  return `${scope === "organization" ? "SD-ORG" : "SD-STR"}-${code}`;
}

export function coverageKeyFor(scope: LicenseScope, organizationId: string, storeId: string | null): string {
  return scope === "organization" ? `org:${organizationId}` : `store:${storeId}`;
}

// ── Reading ──────────────────────────────────────────────────────────────────

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
const iso = (value: unknown): string | null => asDate(value)?.toISOString() ?? null;

export function isEntitled(license: Doc | null | undefined, now = new Date()): boolean {
  if (!license) return false;
  const ends = asDate(license.entitlementExpiresAt);
  return ENTITLED_STATUSES.includes(String(license.status)) && Boolean(ends && ends > now);
}

/**
 * The id of the license covering a store, or null ("Unlicensed"). A record the
 * migration has not reached yet has no `licenseId` at all and reads its old
 * `subscriptionId` (whose license has the same id once migrated).
 */
export function coveringLicenseId(store: Doc): string | null {
  if (store.licenseId !== undefined) {
    return typeof store.licenseId === "string" && store.licenseId ? store.licenseId : null;
  }
  return typeof store.subscriptionId === "string" && store.subscriptionId ? store.subscriptionId : null;
}

/** Whether `license` really covers `store`: same organization, right scope, not cancelled. */
export function licenseCovers(license: Doc | null | undefined, store: Doc): boolean {
  if (!license || license.status === "cancelled") return false;
  if (license.organizationId !== store.organizationId) return false;
  return license.scope === "organization" || license.storeId === store.storeId;
}

/** The store's covering license, or null when it has none (or it no longer covers it). */
export async function coveringLicense(store: Doc): Promise<Doc | null> {
  const licenseId = coveringLicenseId(store);
  if (!licenseId) return null;
  await connectDb();
  const license = (await LicenseModel.findOne({ licenseId }).lean()) as Doc | null;
  return licenseCovers(license, store) ? license : null;
}

/** Covering licenses for many stores in one query, keyed by storeId. */
export async function coveringLicenses(stores: Doc[]): Promise<Map<string, Doc>> {
  const ids = [...new Set(stores.map(coveringLicenseId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  await connectDb();
  const licenses = new Map(
    ((await LicenseModel.find({ licenseId: { $in: ids } }).lean()) as Doc[]).map((license) => [String(license.licenseId), license])
  );
  const result = new Map<string, Doc>();
  for (const store of stores) {
    const license = licenses.get(coveringLicenseId(store) ?? "");
    if (license && licenseCovers(license, store)) result.set(String(store.storeId), license);
  }
  return result;
}

export type LicenseProblem = { code: "STORE_UNLICENSED" | "LICENSE_INACTIVE"; message: string };

/** Why a store is not entitled, in words an operator can act on; null when it is. */
export function licenseProblem(license: Doc | null, now = new Date()): LicenseProblem | null {
  if (!license) {
    return {
      code: "STORE_UNLICENSED",
      message: "This store has no license. Put it on the organization license or give it its own."
    };
  }
  const number = String(license.licenseNumber);
  const status = String(license.status);
  if (!ENTITLED_STATUSES.includes(status)) return { code: "LICENSE_INACTIVE", message: `License ${number} is ${status}.` };
  const ends = asDate(license.entitlementExpiresAt);
  if (!ends || ends <= now) return { code: "LICENSE_INACTIVE", message: `License ${number} has ended; renew it first.` };
  return null;
}

/** The check on read: an entitled license past its date becomes `expired`. */
export async function expireLapsedLicenses(filter: Doc = {}): Promise<number> {
  await connectDb();
  const result = await LicenseModel.updateMany(
    { ...filter, status: { $in: ENTITLED_STATUSES }, entitlementExpiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
  return Number(result.modifiedCount ?? 0);
}

/** What a store view shows about its covering license. */
export function licenseSummary(license: Doc | null | undefined) {
  if (!license) return null;
  return {
    licenseId: String(license.licenseId),
    licenseNumber: String(license.licenseNumber),
    scope: String(license.scope) as LicenseScope,
    plan: String(license.plan),
    status: String(license.status),
    entitlementExpiresAt: iso(license.entitlementExpiresAt),
    maxPcsPerStore: Number(license.maxPcsPerStore ?? DEFAULT_PCS)
  };
}
export type LicenseSummary = NonNullable<ReturnType<typeof licenseSummary>>;

export type CoveredStore = { storeId: string; name: string };

export function licenseView(license: Doc, covered: CoveredStore[] = [], storeName: string | null = null) {
  const ends = asDate(license.entitlementExpiresAt);
  return {
    licenseId: String(license.licenseId),
    licenseNumber: String(license.licenseNumber),
    organizationId: String(license.organizationId),
    scope: String(license.scope) as LicenseScope,
    storeId: license.storeId ? String(license.storeId) : null,
    storeName,
    plan: String(license.plan),
    status: String(license.status),
    startsAt: iso(license.startsAt),
    entitlementExpiresAt: iso(license.entitlementExpiresAt),
    daysRemaining: ends ? Math.ceil((ends.getTime() - Date.now()) / DAY_MS) : null,
    offlineGraceDays: typeof license.offlineGraceDays === "number" ? license.offlineGraceDays : DEFAULT_GRACE,
    maxStores: Number(license.maxStores),
    maxPcsPerStore: Number(license.maxPcsPerStore ?? DEFAULT_PCS),
    notes: license.notes ? String(license.notes) : null,
    seatsUsed: covered.length,
    coveredStores: covered,
    createdAt: iso(license.createdAt),
    updatedAt: iso(license.updatedAt)
  };
}
export type LicenseView = ReturnType<typeof licenseView>;

// ── Schemas ──────────────────────────────────────────────────────────────────

const planSchema = z.enum(["trial", "standard", "custom"]);
const dateInput = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a date, e.g. 2027-09-12T00:00:00Z")
  .transform((value) => new Date(value));
const graceSchema = z.number().int().min(0).max(30);
const seatsSchema = z.number().int().min(1).max(1000);
const pcsSchema = z.number().int().min(1).max(50);
const notesSchema = z.string().trim().max(1000);

const newLicenseShape = {
  plan: planSchema,
  status: z.enum(["trialing", "active"]).optional(),
  entitlementDays: z.number().int().min(1).max(3650).optional(),
  entitlementExpiresAt: dateInput.optional(),
  offlineGraceDays: graceSchema.optional(),
  maxPcsPerStore: pcsSchema.optional(),
  notes: notesSchema.optional()
};
const oneEndDate = (body: { entitlementDays?: number; entitlementExpiresAt?: Date }) =>
  !(body.entitlementDays && body.entitlementExpiresAt);
const ONE_END_DATE = { message: "Give entitlementDays or entitlementExpiresAt, not both" };

/** A store's own new license (store create, switching coverage). */
export const NewLicenseSchema = z.object(newLicenseShape).strict().refine(oneEndDate, ONE_END_DATE);
export type NewLicense = z.output<typeof NewLicenseSchema>;

/** The organization license created with a new organization. */
export const OrganizationLicenseSchema = z
  .object({ ...newLicenseShape, maxStores: seatsSchema.optional() })
  .strict()
  .refine(oneEndDate, ONE_END_DATE);
export type OrganizationLicenseInput = z.output<typeof OrganizationLicenseSchema>;

export const LicenseCreateSchema = z
  .object({
    scope: z.enum(["organization", "store"]),
    storeId: z.string().trim().min(1).max(80).optional(),
    ...newLicenseShape,
    maxStores: seatsSchema.optional()
  })
  .strict()
  .refine(oneEndDate, ONE_END_DATE)
  .refine((body) => body.scope === "organization" || Boolean(body.storeId), {
    message: "a store license needs the store",
    path: ["storeId"]
  })
  .refine((body) => (body.scope === "store" ? body.maxStores === undefined || body.maxStores === 1 : !body.storeId), {
    message: "a store license covers exactly its one store; an organization license names no store"
  });
export type LicenseCreate = z.output<typeof LicenseCreateSchema>;

export const LicensePatchSchema = z
  .object({
    plan: planSchema.optional(),
    status: z.enum(LICENSE_STATUSES).optional(),
    entitlementExpiresAt: dateInput.optional(),
    renewDays: z.number().int().min(1).max(3650).optional(),
    offlineGraceDays: graceSchema.optional(),
    maxStores: seatsSchema.optional(),
    maxPcsPerStore: pcsSchema.optional(),
    notes: notesSchema.nullable().optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" })
  .refine((body) => !(body.renewDays && body.entitlementExpiresAt), {
    message: "Give renewDays or entitlementExpiresAt, not both"
  });
export type LicensePatch = z.output<typeof LicensePatchSchema>;

/** `PUT …/stores/{store}/license` and store create's `license`. */
export const CoverageSchema = z
  .object({
    mode: z.enum(["organization", "store", "none"]),
    newLicense: NewLicenseSchema.optional()
  })
  .strict();
export type Coverage = z.output<typeof CoverageSchema>;

// ── Writing ──────────────────────────────────────────────────────────────────

function duplicateOn(error: unknown, field: string): boolean {
  const record = error as { code?: unknown; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return record?.code === 11000 && Boolean((record.keyPattern && field in record.keyPattern) || (record.keyValue && field in record.keyValue));
}

function licenseExists(scope: LicenseScope, existing: Doc | null): ControlPlaneError {
  const which = existing ? ` (${String(existing.licenseNumber)})` : "";
  return new ControlPlaneError(
    409,
    "LICENSE_EXISTS",
    scope === "organization"
      ? `This organization already has an organization license${which}. Renew or change it instead.`
      : `This store already has its own license${which}. Renew it instead.`
  );
}

async function insertLicense(
  organizationId: string,
  scope: LicenseScope,
  storeId: string | null,
  input: NewLicense & { maxStores?: number }
): Promise<Doc> {
  await connectDb();
  const coverageKey = coverageKeyFor(scope, organizationId, storeId);
  const existing = (await LicenseModel.findOne({ coverageKey }).lean()) as Doc | null;
  if (existing) throw licenseExists(scope, existing);
  const startsAt = new Date();
  const days = input.entitlementDays ?? (input.plan === "trial" ? 30 : 365);
  const ends = input.entitlementExpiresAt ?? new Date(startsAt.getTime() + days * DAY_MS);
  if (ends <= startsAt) throw new ControlPlaneError(400, "REQUEST_INVALID", "entitlementExpiresAt: must be in the future");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const doc = await LicenseModel.create({
        organizationId,
        licenseId: publicId("lic"),
        licenseNumber: newLicenseNumber(scope),
        scope,
        ...(storeId ? { storeId } : {}),
        plan: input.plan,
        status: input.status ?? (input.plan === "trial" ? "trialing" : "active"),
        startsAt,
        entitlementExpiresAt: ends,
        offlineGraceDays: input.offlineGraceDays ?? DEFAULT_GRACE,
        maxStores: scope === "store" ? 1 : (input.maxStores ?? DEFAULT_SEATS),
        maxPcsPerStore: input.maxPcsPerStore ?? DEFAULT_PCS,
        ...(input.notes ? { notes: input.notes } : {}),
        coverageKey
      });
      return doc.toObject() as Doc;
    } catch (error) {
      if (duplicateOn(error, "coverageKey")) throw licenseExists(scope, null);
      if (duplicateOn(error, "licenseNumber")) continue;
      throw error;
    }
  }
  throw new ControlPlaneError(503, "LICENSE_NUMBER_BUSY", "Could not allocate a license number; try again", true);
}

export async function organizationLicense(organizationId: string): Promise<Doc | null> {
  await connectDb();
  return (await LicenseModel.findOne({ coverageKey: coverageKeyFor("organization", organizationId, null) }).lean()) as Doc | null;
}

async function ownStoreLicense(storeId: string): Promise<Doc | null> {
  return (await LicenseModel.findOne({ coverageKey: coverageKeyFor("store", "", storeId) }).lean()) as Doc | null;
}

export async function seatsUsed(licenseId: string): Promise<number> {
  await connectDb();
  return TenantStoreModel.countDocuments({ licenseId });
}

export function seatsFull(license: Doc, used: number): ControlPlaneError {
  return new ControlPlaneError(
    402,
    "LICENSE_SEATS_FULL",
    `All ${String(license.maxStores)} seats of ${String(license.licenseNumber)} are used. Add seats or give this store its own license.`,
    false,
    { seatsUsed: used, maxStores: Number(license.maxStores) }
  );
}

/** Refuses when the organization license has no free seat (before a store is put on it). */
export async function assertSeatFree(license: Doc): Promise<void> {
  const used = await seatsUsed(String(license.licenseId));
  if (used >= Number(license.maxStores)) throw seatsFull(license, used);
}

/** After a store was put on the license: false when a concurrent change took the last seat. */
export async function seatsWithinLimit(license: Doc): Promise<boolean> {
  return (await seatsUsed(String(license.licenseId))) <= Number(license.maxStores);
}

async function coveredStores(organizationId: string, licenseId: string): Promise<CoveredStore[]> {
  const stores = (await TenantStoreModel.find({ organizationId, licenseId }).select("storeId name").sort({ name: 1 }).lean()) as Doc[];
  return stores.map((store) => ({ storeId: String(store.storeId), name: String(store.name) }));
}

function auditLicense(admin: InternalAdminActor, action: string, license: Doc, metadata: Doc = {}) {
  return auditAdmin(admin, {
    organizationId: String(license.organizationId),
    storeId: license.storeId ? String(license.storeId) : undefined,
    action,
    targetType: "license",
    targetId: String(license.licenseId),
    metadata: { licenseNumber: license.licenseNumber, scope: license.scope, ...metadata }
  });
}

/** Create a store's own license and make it the store's covering license. */
export async function giveStoreOwnLicense(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  input: NewLicense,
  previousLicenseId: string | null
): Promise<Doc> {
  const license = await insertLicense(organizationId, "store", storeId, input);
  await TenantStoreModel.updateOne(
    { organizationId, storeId },
    { $set: { licenseId: license.licenseId }, $unset: { subscriptionId: 1 } }
  );
  await auditLicense(admin, "license.create", license, { plan: license.plan, entitlementExpiresAt: license.entitlementExpiresAt });
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.license.change",
    targetType: "store",
    targetId: storeId,
    metadata: { mode: "store", from: previousLicenseId, to: license.licenseId, toNumber: license.licenseNumber }
  });
  scheduleNotify({ organizationId, storeId, reason: "store.license.change" });
  return license;
}

/**
 * `POST …/licenses`. An organization license starts with no stores; a store
 * license becomes its store's covering license at once (freeing the store's
 * seat on the organization license, if it had one).
 */
export async function createLicense(admin: InternalAdminActor, organizationId: string, body: LicenseCreate) {
  await connectDb();
  if (!(await OrganizationModel.exists({ organizationId }))) throw notFound("Organization");
  if (body.scope === "store") {
    const store = (await TenantStoreModel.findOne({ organizationId, storeId: body.storeId }).lean()) as Doc | null;
    if (!store) throw new ControlPlaneError(400, "STORE_UNKNOWN", "storeId: not a store of this organization");
    const license = await giveStoreOwnLicense(admin, organizationId, String(store.storeId), body, coveringLicenseId(store));
    return licenseView(license, [{ storeId: String(store.storeId), name: String(store.name) }], String(store.name));
  }
  const license = await insertLicense(organizationId, "organization", null, body);
  await auditLicense(admin, "license.create", license, {
    plan: license.plan,
    maxStores: license.maxStores,
    entitlementExpiresAt: license.entitlementExpiresAt
  });
  return licenseView(license, []);
}

/** Both scopes, the organization license first, each with the stores it covers. */
export async function listLicenses(organizationId: string): Promise<LicenseView[]> {
  await connectDb();
  await expireLapsedLicenses({ organizationId });
  const [licenses, stores] = (await Promise.all([
    LicenseModel.find({ organizationId }).sort({ scope: 1, createdAt: -1 }).lean(),
    TenantStoreModel.find({ organizationId }).select("organizationId storeId name licenseId subscriptionId").sort({ name: 1 }).lean()
  ])) as [Doc[], Doc[]];
  const names = new Map(stores.map((store) => [String(store.storeId), String(store.name)]));
  const byLicense = new Map<string, Doc>(licenses.map((license) => [String(license.licenseId), license]));
  const covered = new Map<string, CoveredStore[]>();
  for (const store of stores) {
    const id = coveringLicenseId(store);
    if (!id || !licenseCovers(byLicense.get(id), store)) continue;
    const list = covered.get(id) ?? [];
    list.push({ storeId: String(store.storeId), name: String(store.name) });
    covered.set(id, list);
  }
  return licenses.map((license) =>
    licenseView(
      license,
      covered.get(String(license.licenseId)) ?? [],
      license.storeId ? (names.get(String(license.storeId)) ?? null) : null
    )
  );
}

/**
 * `PATCH …/licenses/{licenseId}`: plan, status (suspend / resume / cancel),
 * renew, end date, seats (not below seats used), PCs per store (not below the
 * busiest covered store), grace, notes. A cancelled license is final;
 * cancelling one leaves the stores it covered Unlicensed. Every store the
 * license covers is notified.
 */
export async function updateLicense(admin: InternalAdminActor, organizationId: string, licenseId: string, body: LicensePatch) {
  await connectDb();
  const current = (await LicenseModel.findOne({ organizationId, licenseId }).lean()) as Doc | null;
  if (!current) throw notFound("License");
  if (current.status === "cancelled") {
    throw new ControlPlaneError(409, "LICENSE_CANCELLED", "A cancelled license can't be changed; create a new one.");
  }
  const covered = await coveredStores(organizationId, licenseId);
  const now = new Date();
  const set: Doc = {};
  const unset: Doc = {};

  if (body.plan) set.plan = body.plan;
  if (body.offlineGraceDays !== undefined) set.offlineGraceDays = body.offlineGraceDays;
  if (body.notes !== undefined) {
    if (body.notes) set.notes = body.notes;
    else unset.notes = 1;
  }
  if (body.renewDays) {
    const currentEnd = asDate(current.entitlementExpiresAt);
    const base = currentEnd && currentEnd > now ? currentEnd : now;
    set.entitlementExpiresAt = new Date(base.getTime() + body.renewDays * DAY_MS);
    // Renewing a lapsed license brings it back; a suspended one stays suspended.
    if (!body.status && current.status === "expired") {
      set.status = (body.plan ?? current.plan) === "trial" ? "trialing" : "active";
    }
  }
  if (body.entitlementExpiresAt) set.entitlementExpiresAt = body.entitlementExpiresAt;
  if (body.status) set.status = body.status;
  if (body.status === "cancelled") unset.coverageKey = 1;

  if (body.maxStores !== undefined) {
    if (current.scope === "store" && body.maxStores !== 1) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "maxStores: a store license covers exactly one store");
    }
    if (body.maxStores < covered.length) {
      throw new ControlPlaneError(
        409,
        "LIMIT_BELOW_USAGE",
        `${covered.length} stores use this license; move stores off it before lowering the seats to ${body.maxStores}.`
      );
    }
    set.maxStores = body.maxStores;
  }
  if (body.maxPcsPerStore !== undefined) {
    if (covered.length) {
      const busiest = (await WorkerInstallationModel.aggregate([
        { $match: { organizationId, storeId: { $in: covered.map((store) => store.storeId) } } },
        { $group: { _id: "$storeId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])) as Array<{ count: number }>;
      const most = busiest[0]?.count ?? 0;
      if (body.maxPcsPerStore < most) {
        throw new ControlPlaneError(
          409,
          "LIMIT_BELOW_USAGE",
          `A store on this license has ${most} PCs; replace or remove PCs before lowering the limit to ${body.maxPcsPerStore}.`
        );
      }
    }
    set.maxPcsPerStore = body.maxPcsPerStore;
  }

  const resultStatus = String(set.status ?? current.status);
  const resultEnd = asDate(set.entitlementExpiresAt ?? current.entitlementExpiresAt);
  if (ENTITLED_STATUSES.includes(resultStatus) && (!resultEnd || resultEnd <= now)) {
    throw new ControlPlaneError(
      400,
      "ENTITLEMENT_ENDED",
      "The end date has passed; renew or set a future end date to make the license active."
    );
  }

  const updated = (await LicenseModel.findOneAndUpdate(
    { organizationId, licenseId },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after", runValidators: true }
  ).lean()) as Doc;

  if (body.status === "cancelled" && covered.length) {
    await TenantStoreModel.updateMany({ organizationId, licenseId }, { $set: { licenseId: null }, $unset: { subscriptionId: 1 } });
  }

  const resumed =
    body.status !== undefined &&
    ENTITLED_STATUSES.includes(body.status) &&
    !ENTITLED_STATUSES.includes(String(current.status));
  const action = body.renewDays
    ? "license.renew"
    : body.status === "suspended"
      ? "license.suspend"
      : body.status === "cancelled"
        ? "license.cancel"
        : resumed
          ? "license.resume"
          : "license.update";
  await auditLicense(admin, action, updated, {
    changes: { ...set, ...(Object.keys(unset).length ? { removed: Object.keys(unset) } : {}) },
    previousStatus: current.status,
    ...(body.status === "cancelled" ? { storesUnlicensed: covered.map((store) => store.storeId) } : {})
  });
  if (covered.length) {
    scheduleNotify({ organizationId, storeIds: covered.map((store) => store.storeId), reason: "license.change" });
  }
  return licenseView(
    updated,
    body.status === "cancelled" ? [] : covered,
    updated.storeId ? (covered[0]?.name ?? null) : null
  );
}

/**
 * Switch a store's coverage (`PUT …/stores/{store}/license`):
 * - `organization`: onto the organization license, if it has a free seat;
 * - `store`: its own store license — `newLicense` creates one; without it the
 *   store's existing store license is used;
 * - `none`: Unlicensed (the PC cannot activate and sign-in is refused).
 * Switching away from the store's own license cancels that license.
 */
export async function setStoreCoverage(admin: InternalAdminActor, organizationId: string, storeId: string, body: Coverage) {
  await connectDb();
  const store = (await TenantStoreModel.findOne({ organizationId, storeId }).lean()) as Doc | null;
  if (!store) throw notFound("Store");
  const currentId = coveringLicenseId(store);
  const own = await ownStoreLicense(storeId);

  if (body.mode === "store" && body.newLicense) {
    if (own) throw licenseExists("store", own);
    const license = await giveStoreOwnLicense(admin, organizationId, storeId, body.newLicense, currentId);
    return { changed: true, licenseId: String(license.licenseId) };
  }

  let target: Doc | null = null;
  if (body.mode === "organization") {
    target = await organizationLicense(organizationId);
    if (!target) {
      throw new ControlPlaneError(409, "NO_ORGANIZATION_LICENSE", "This organization has no organization license to put the store on.");
    }
    if (currentId !== target.licenseId) await assertSeatFree(target);
  } else if (body.mode === "store") {
    if (!own) {
      throw new ControlPlaneError(400, "NEW_LICENSE_REQUIRED", "newLicense: this store has no license of its own yet; give its plan and length");
    }
    target = own;
  }
  const targetId = target ? String(target.licenseId) : null;
  if (targetId === currentId && store.licenseId !== undefined) return { changed: false, licenseId: targetId };

  await TenantStoreModel.updateOne({ organizationId, storeId }, { $set: { licenseId: targetId }, $unset: { subscriptionId: 1 } });
  if (target && body.mode === "organization" && !(await seatsWithinLimit(target))) {
    // A concurrent change took the last seat: put the store back.
    await TenantStoreModel.updateOne({ organizationId, storeId }, { $set: { licenseId: currentId } });
    throw seatsFull(target, await seatsUsed(targetId!));
  }

  // Switching away from the store's own license cancels it.
  if (own && targetId !== own.licenseId) {
    const cancelled = (await LicenseModel.findOneAndUpdate(
      { licenseId: own.licenseId },
      { $set: { status: "cancelled" }, $unset: { coverageKey: 1 } },
      { returnDocument: "after" }
    ).lean()) as Doc;
    await auditLicense(admin, "license.cancel", cancelled, { reason: "coverage switched", previousStatus: own.status });
  }
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.license.change",
    targetType: "store",
    targetId: storeId,
    metadata: { mode: body.mode, from: currentId, to: targetId, toNumber: target?.licenseNumber ?? null }
  });
  scheduleNotify({ organizationId, storeId, reason: "store.license.change" });
  return { changed: true, licenseId: targetId };
}

export type NewStoreCoverage = { mode: Coverage["mode"]; license: Doc | null; newLicense: NewLicense | null };

/** Validate the coverage chosen for a store about to be created (default: the organization license). */
export async function prepareNewStoreCoverage(organizationId: string, choice: Coverage | undefined): Promise<NewStoreCoverage> {
  const mode = choice?.mode ?? "organization";
  if (mode === "none") return { mode, license: null, newLicense: null };
  if (mode === "store") {
    if (!choice?.newLicense) {
      throw new ControlPlaneError(400, "NEW_LICENSE_REQUIRED", "license.newLicense: give the plan and length of the store's own license");
    }
    return { mode, license: null, newLicense: choice.newLicense };
  }
  const license = await organizationLicense(organizationId);
  if (!license) {
    throw new ControlPlaneError(
      409,
      "NO_ORGANIZATION_LICENSE",
      "This organization has no organization license. Give the store its own license, or add an organization license first."
    );
  }
  await assertSeatFree(license);
  return { mode, license, newLicense: null };
}
