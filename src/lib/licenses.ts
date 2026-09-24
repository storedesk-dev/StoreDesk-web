import { randomInt } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { LicenseModel, OrganizationModel, TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { productFilter, STOREDESK } from "@/lib/products";
import { auditAdmin } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { scheduleNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Licenses. **One store, one license** — there is no other shape.
 *
 * A store has at most one non-cancelled license; a store without one is Unlicensed.
 *
 * There used to be a second shape: a `master` license on the organization covering every store
 * under it, with each organization carrying a mode saying which of the two applied. It is gone
 * (D-22). The market is single store, single billing, on its own cycle — so the grouping earned
 * nothing, and the mode was a second question every read had to answer before it could answer the
 * first.
 *
 * Coverage is derived, never stored: `coveringFrom(store, licenses)` is the one rule, and
 * activation (redeem, key issue), the access sync's `subscription` block, the dashboard and every
 * view read through it. (Stores used to carry a `licenseId`; the migration removes it.)
 *
 * "One non-cancelled per store" is enforced by a unique partial index on `coverageKey`
 * (`store:<storeId>`), set while a license is not cancelled.
 */

type Doc = Record<string, unknown>;

export const ENTITLED_STATUSES = ["trialing", "active"];
export const LICENSE_STATUSES = ["trialing", "active", "suspended", "cancelled", "expired"] as const;
const DAY_MS = 86_400_000;
const DEFAULT_PCS = 1;
const DEFAULT_GRACE = 7;

// ── License numbers ──────────────────────────────────────────────────────────

/** Crockford base32: no I, L, O or U, so a number read aloud or typed is never ambiguous. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** `SD-ORG-` was a master licence's prefix. Still matched, so an old number is read, never issued. */
export const LICENSE_NUMBER = /^SD-(ORG|STR)-[0-9A-HJKMNP-TV-Z]{6}$/;

export function newLicenseNumber(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) code += CROCKFORD[randomInt(CROCKFORD.length)];
  return `SD-STR-${code}`;
}

export function coverageKeyFor(storeId: string): string {
  return `store:${storeId}`;
}

// ── Coverage: the one rule ───────────────────────────────────────────────────

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
 * THE coverage rule, and now it is one line of thought: a store is covered by its own
 * non-cancelled license, or by nothing.
 */
export function coveringFrom(store: Doc, licenses: Doc[]): Doc | null {
  const key = coverageKeyFor(String(store.storeId));
  return licenses.find((license) => license.coverageKey === key && license.status !== "cancelled") ?? null;
}

export type Coverage = { license: Doc | null };

/** A store's covering license, or null when it is Unlicensed. */
export async function coverageFor(store: Doc): Promise<Coverage> {
  await connectDb();
  const licenses = (await LicenseModel.find({ coverageKey: coverageKeyFor(String(store.storeId)) }).lean()) as Doc[];
  return { license: coveringFrom(store, licenses) };
}

export async function coveringLicense(store: Doc): Promise<Doc | null> {
  return (await coverageFor(store)).license;
}

/** Non-cancelled licenses for many stores at once, so a list page is one query rather than N. */
export async function coverageIndex(filter: Doc = {}) {
  await connectDb();
  const licenses = (await LicenseModel.find({ ...filter, coverageKey: { $type: "string" } }).lean()) as Doc[];
  const byStore = new Map<string, Doc[]>();
  for (const license of licenses) {
    const storeId = String(license.storeId ?? "");
    const list = byStore.get(storeId) ?? [];
    list.push(license);
    byStore.set(storeId, list);
  }
  return {
    licenses,
    licensesOf: (storeId: string) => byStore.get(storeId) ?? [],
    licenseFor: (store: Doc) => coveringFrom(store, byStore.get(String(store.storeId)) ?? [])
  };
}

/** Covering licenses for many stores, keyed by storeId. */
export async function coveringLicenses(stores: Doc[]): Promise<Map<string, Doc>> {
  const storeIds = stores.map((store) => String(store.storeId));
  if (!storeIds.length) return new Map();
  const index = await coverageIndex({ storeId: { $in: storeIds } });
  const result = new Map<string, Doc>();
  for (const store of stores) {
    const license = index.licenseFor(store);
    if (license) result.set(String(store.storeId), license);
  }
  return result;
}

export type LicenseProblem = { code: "STORE_UNLICENSED" | "LICENSE_INACTIVE"; message: string };

/** Why a store is not entitled, in words an operator can act on; null when it is. */
export function licenseProblem(license: Doc | null, now = new Date()): LicenseProblem | null {
  if (!license) {
    return { code: "STORE_UNLICENSED", message: "This store has no license. Issue it one on its License tab." };
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
    scope: String(license.scope),
    plan: String(license.plan),
    status: String(license.status),
    entitlementExpiresAt: iso(license.entitlementExpiresAt),
    offlineGraceDays: typeof license.offlineGraceDays === "number" ? license.offlineGraceDays : DEFAULT_GRACE,
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
    scope: String(license.scope),
    storeId: license.storeId ? String(license.storeId) : null,
    storeName,
    plan: String(license.plan),
    status: String(license.status),
    startsAt: iso(license.startsAt),
    entitlementExpiresAt: iso(license.entitlementExpiresAt),
    daysRemaining: ends ? Math.ceil((ends.getTime() - Date.now()) / DAY_MS) : null,
    offlineGraceDays: typeof license.offlineGraceDays === "number" ? license.offlineGraceDays : DEFAULT_GRACE,
    maxPcsPerStore: Number(license.maxPcsPerStore ?? DEFAULT_PCS),
    notes: license.notes ? String(license.notes) : null,
    /** Its store — or none at all, when the license is cancelled. */
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
const pcsSchema = z.number().int().min(1).max(50);
const notesSchema = z.string().trim().max(1000);
const daysSchema = z.number().int().min(1).max(3650);

const newLicenseShape = {
  plan: planSchema,
  status: z.enum(["trialing", "active"]).optional(),
  entitlementDays: daysSchema.optional(),
  entitlementExpiresAt: dateInput.optional(),
  offlineGraceDays: graceSchema.optional(),
  maxPcsPerStore: pcsSchema.optional(),
  notes: notesSchema.optional()
};
const oneEndDate = (body: { entitlementDays?: number; entitlementExpiresAt?: Date }) =>
  !(body.entitlementDays && body.entitlementExpiresAt);
const ONE_END_DATE = { message: "Give entitlementDays or entitlementExpiresAt, not both" };

/** A new license's terms: plan, status, end (days or date), grace, PCs per store, notes. */
export const NewLicenseSchema = z.object(newLicenseShape).strict().refine(oneEndDate, ONE_END_DATE);
export type NewLicense = z.output<typeof NewLicenseSchema>;

export const LicenseCreateSchema = z
  .object({ storeId: z.string().trim().min(1).max(80), ...newLicenseShape })
  .strict()
  .refine(oneEndDate, ONE_END_DATE);
export type LicenseCreate = z.output<typeof LicenseCreateSchema>;

const patchShape = {
  plan: planSchema.optional(),
  status: z.enum(LICENSE_STATUSES).optional(),
  entitlementExpiresAt: dateInput.optional(),
  renewDays: daysSchema.optional(),
  offlineGraceDays: graceSchema.optional(),
  maxPcsPerStore: pcsSchema.optional(),
  notes: notesSchema.nullable().optional()
};

export const LicensePatchSchema = z
  .object(patchShape)
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" })
  .refine((body) => !(body.renewDays && body.entitlementExpiresAt), {
    message: "Give renewDays or entitlementExpiresAt, not both"
  });
export type LicensePatch = z.output<typeof LicensePatchSchema>;

/**
 * `PUT …/stores/{store}/license` (store-wise only): issue the store's license
 * when it has none (`plan` and `entitlementDays` or `entitlementExpiresAt`),
 * else edit it (the PATCH fields).
 */
export const StoreLicenseSchema = z
  .object({ ...patchShape, entitlementDays: daysSchema.optional() })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" })
  .refine((body) => [body.renewDays, body.entitlementDays, body.entitlementExpiresAt].filter(Boolean).length <= 1, {
    message: "Give one of renewDays, entitlementDays or entitlementExpiresAt"
  });
export type StoreLicenseBody = z.output<typeof StoreLicenseSchema>;

// ── Writing ──────────────────────────────────────────────────────────────────

function duplicateOn(error: unknown, field: string): boolean {
  const record = error as { code?: unknown; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return record?.code === 11000 && Boolean((record.keyPattern && field in record.keyPattern) || (record.keyValue && field in record.keyValue));
}

function storeLicenseExists(existing: Doc | null): ControlPlaneError {
  const which = existing ? ` (${String(existing.licenseNumber)})` : "";
  return new ControlPlaneError(409, "LICENSE_EXISTS", `This store already has its license${which}. Renew or edit it instead.`);
}

/** Start and end of a new license; 400 for an end date that is not in the future. */
function licenseTerms(input: NewLicense, now = new Date()) {
  const days = input.entitlementDays ?? (input.plan === "trial" ? 30 : 365);
  const ends = input.entitlementExpiresAt ?? new Date(now.getTime() + days * DAY_MS);
  if (ends <= now) throw new ControlPlaneError(400, "REQUEST_INVALID", "entitlementExpiresAt: must be in the future");
  return { startsAt: now, entitlementExpiresAt: ends };
}

/**
 * A license document, without its id and number (given at insert).
 *
 * `scope` is still written, and it is always "store". The column stays because old master rows
 * are still in the database and still readable; nothing new is ever written with another value.
 */
function licenseDoc(organizationId: string, storeId: string, input: NewLicense): Doc {
  return {
    organizationId,
    scope: "store",
    storeId,
    plan: input.plan,
    status: input.status ?? (input.plan === "trial" ? "trialing" : "active"),
    ...licenseTerms(input),
    offlineGraceDays: input.offlineGraceDays ?? DEFAULT_GRACE,
    maxPcsPerStore: input.maxPcsPerStore ?? DEFAULT_PCS,
    ...(input.notes ? { notes: input.notes } : {}),
    coverageKey: coverageKeyFor(storeId)
  };
}

async function insertLicense(doc: Doc): Promise<Doc> {
  await connectDb();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await LicenseModel.create({ ...doc, licenseId: publicId("lic"), licenseNumber: newLicenseNumber() });
      return created.toObject() as Doc;
    } catch (error) {
      if (duplicateOn(error, "licenseNumber")) continue;
      throw error;
    }
  }
  throw new ControlPlaneError(503, "LICENSE_NUMBER_BUSY", "Could not allocate a license number; try again", true);
}

async function requireOrg(organizationId: string): Promise<Doc> {
  await connectDb();
  const org = (await OrganizationModel.findOne({ organizationId }).lean()) as Doc | null;
  if (!org) throw notFound("Organization");
  return org;
}

async function ownStoreLicense(organizationId: string, storeId: string): Promise<Doc | null> {
  return (await LicenseModel.findOne({ coverageKey: coverageKeyFor(storeId), organizationId }).lean()) as Doc | null;
}

async function storesOf(organizationId: string): Promise<CoveredStore[]> {
  const stores = (await TenantStoreModel.find({ organizationId }).select("storeId name").sort({ name: 1 }).lean()) as Doc[];
  return stores.map((store) => ({ storeId: String(store.storeId), name: String(store.name) }));
}

/**
 * The store a (non-cancelled) license covers — one, or none.
 *
 * An old master row covers nothing: it names no store, and there is no longer a mode under which
 * it could stand for all of them. It is shown in the list so nobody wonders where it went.
 */
async function coveredBy(license: Doc): Promise<CoveredStore[]> {
  if (license.status === "cancelled" || !license.storeId) return [];
  const store = (await TenantStoreModel.findOne({
    organizationId: String(license.organizationId),
    storeId: license.storeId
  })
    .select("storeId name")
    .lean()) as Doc | null;
  return store ? [{ storeId: String(store.storeId), name: String(store.name) }] : [];
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

/** Check a new store license's terms before anything is written (store create). */
export function checkNewLicense(input: NewLicense): void {
  licenseTerms(input);
}

/** Issue a store's license (store-wise). 409 LICENSE_EXISTS when it has one. */
export async function issueStoreLicense(admin: InternalAdminActor, organizationId: string, store: CoveredStore, input: NewLicense) {
  const existing = await ownStoreLicense(organizationId, store.storeId);
  if (existing) throw storeLicenseExists(existing);
  let license: Doc;
  try {
    license = await insertLicense(licenseDoc(organizationId, store.storeId, input));
  } catch (error) {
    if (duplicateOn(error, "coverageKey")) throw storeLicenseExists(null);
    throw error;
  }
  await auditLicense(admin, "license.create", license, { plan: license.plan, entitlementExpiresAt: license.entitlementExpiresAt });
  scheduleNotify({ organizationId, storeId: store.storeId, reason: "store.license.change" });
  return licenseView(license, [store], store.name);
}

/** `POST …/licenses`: a store's license. There is no other kind. */
export async function createLicense(admin: InternalAdminActor, organizationId: string, body: LicenseCreate) {
  await requireOrg(organizationId);
  const store = (await TenantStoreModel.findOne({ organizationId, storeId: body.storeId }).select("storeId name").lean()) as Doc | null;
  if (!store) throw new ControlPlaneError(400, "STORE_UNKNOWN", "storeId: not a store of this organization");
  return issueStoreLicense(admin, organizationId, { storeId: String(store.storeId), name: String(store.name) }, body);
}

/** Every license of an organization's stores, cancelled ones too, newest first, each with its store. */
export async function listLicenses(organizationId: string): Promise<{ licenses: LicenseView[] }> {
  await requireOrg(organizationId);
  await expireLapsedLicenses({ organizationId });
  const [licenses, stores] = (await Promise.all([
    LicenseModel.find({ organizationId }).sort({ createdAt: -1 }).lean(),
    storesOf(organizationId)
  ])) as [Doc[], CoveredStore[]];
  const names = new Map(stores.map((store) => [store.storeId, store.name]));
  return {
    licenses: licenses.map((license) => {
      const storeId = license.storeId ? String(license.storeId) : null;
      // A cancelled licence covers nothing, and neither does an old master row: it names no store.
      const covered =
        license.status !== "cancelled" && storeId && names.has(storeId)
          ? [{ storeId, name: names.get(storeId)! }]
          : [];
      return licenseView(license, covered, storeId ? (names.get(storeId) ?? null) : null);
    })
  };
}

/**
 * `PATCH …/licenses/{licenseId}`: plan, status (suspend / resume / cancel),
 * renew, end date, PCs per store (not below what its store already has), grace,
 * notes. A cancelled license is final, and cancelling one leaves its store
 * Unlicensed. The store is notified.
 */
export async function updateLicense(admin: InternalAdminActor, organizationId: string, licenseId: string, body: LicensePatch) {
  await requireOrg(organizationId);
  const current = (await LicenseModel.findOne({ organizationId, licenseId }).lean()) as Doc | null;
  if (!current) throw notFound("License");
  if (current.status === "cancelled") {
    throw new ControlPlaneError(409, "LICENSE_CANCELLED", "A cancelled license can't be changed; create a new one.");
  }
  const covered = await coveredBy(current);
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

  if (body.maxPcsPerStore !== undefined) {
    if (covered.length) {
      const busiest = (await WorkerInstallationModel.aggregate([
        {
          $match: {
            organizationId,
            storeId: { $in: covered.map((store) => store.storeId) },
            // A lottery PC never counts against maxPcsPerStore.
            ...productFilter(STOREDESK)
          }
        },
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

  const resumed =
    body.status !== undefined && ENTITLED_STATUSES.includes(body.status) && !ENTITLED_STATUSES.includes(String(current.status));
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
  return licenseView(updated, body.status === "cancelled" ? [] : covered, updated.storeId ? (covered[0]?.name ?? null) : null);
}

/** `PUT …/stores/{store}/license`: issue the store's license when it has none, else edit it. */
export async function upsertStoreLicense(admin: InternalAdminActor, organizationId: string, storeId: string, body: StoreLicenseBody) {
  await requireOrg(organizationId);
  const store = (await TenantStoreModel.findOne({ organizationId, storeId }).select("storeId name").lean()) as Doc | null;
  if (!store) throw notFound("Store");
  const own = await ownStoreLicense(organizationId, storeId);
  if (!own) {
    if (!body.plan) throw new ControlPlaneError(400, "REQUEST_INVALID", "plan: this store has no license yet; give its plan and end date");
    if (body.renewDays || (body.status && !ENTITLED_STATUSES.includes(body.status))) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "This store has no license yet; issue one with plan and entitlementDays or entitlementExpiresAt");
    }
    const license = await issueStoreLicense(
      admin,
      organizationId,
      { storeId, name: String(store.name) },
      {
        plan: body.plan,
        status: body.status as "trialing" | "active" | undefined,
        entitlementDays: body.entitlementDays,
        entitlementExpiresAt: body.entitlementExpiresAt,
        offlineGraceDays: body.offlineGraceDays,
        maxPcsPerStore: body.maxPcsPerStore,
        notes: body.notes ?? undefined
      }
    );
    return { created: true, license };
  }
  if (body.entitlementDays) {
    throw new ControlPlaneError(400, "REQUEST_INVALID", "entitlementDays: the store has a license; use renewDays or entitlementExpiresAt");
  }
  const { entitlementDays: _ignored, ...patch } = body;
  void _ignored;
  const license = await updateLicense(admin, organizationId, String(own.licenseId), patch);
  return { created: false, license };
}

