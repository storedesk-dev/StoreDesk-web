import { randomInt } from "node:crypto";
import { z } from "zod";
import { abortTransaction, commitTransaction, connectDb, startTransaction, withSession } from "@/lib/db";
import { LicenseModel, OrganizationModel, TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { productFilter, STOREDESK } from "@/lib/products";
import { auditAdmin } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { scheduleNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Licenses (docs/design/control-plane-admin.md, "Licenses"). Each
 * organization has ONE licensing mode (`Organization.licensing.mode`):
 *
 * - `master`: one non-cancelled license with scope "organization" — the master
 *   license — covers every store of the organization, including stores added
 *   later. No store limit.
 * - `storeWise`: each store has at most one non-cancelled store license; a
 *   store without one is Unlicensed. No organization license exists.
 *
 * Coverage is derived, never stored: `coveringFrom(mode, store, licenses)` is
 * the one rule, and activation (redeem, key issue), the access sync's
 * `subscription` block, the dashboard and every view read through it. (Stores
 * used to carry a `licenseId`; the migration removes it.)
 *
 * "One non-cancelled per scope" is enforced by a unique partial index on
 * `coverageKey` (`org:<organizationId>` / `store:<storeId>`), set while a
 * license is not cancelled.
 */

type Doc = Record<string, unknown>;
export type LicenseScope = "organization" | "store";
export type LicensingMode = "master" | "storeWise";
export const LICENSING_MODES = ["master", "storeWise"] as const;

export const ENTITLED_STATUSES = ["trialing", "active"];
export const LICENSE_STATUSES = ["trialing", "active", "suspended", "cancelled", "expired"] as const;
const DAY_MS = 86_400_000;
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

/** The mode stored on the organization, or null on a record the migration has not reached. */
export function storedMode(org: Doc | null | undefined): LicensingMode | null {
  const mode = (org?.licensing as Doc | undefined)?.mode;
  return mode === "master" || mode === "storeWise" ? mode : null;
}

/**
 * The organization's mode: as stored, else (a record the migration has not
 * reached) master when it has a non-cancelled organization license.
 * `licenses` are the organization's non-cancelled licenses.
 */
export function modeOf(org: Doc | null | undefined, licenses: Doc[]): LicensingMode {
  const stored = storedMode(org);
  if (stored) return stored;
  const masterKey = coverageKeyFor("organization", String(org?.organizationId ?? ""), null);
  return licenses.some((license) => license.coverageKey === masterKey) ? "master" : "storeWise";
}

/**
 * THE coverage rule. Master mode: the organization's master license. Store-wise:
 * the store's own license. Anything else — a store license in master mode, an
 * organization license in store-wise mode, a cancelled license — covers nothing.
 */
export function coveringFrom(mode: LicensingMode, store: Doc, licenses: Doc[]): Doc | null {
  const organizationId = String(store.organizationId);
  const key =
    mode === "master"
      ? coverageKeyFor("organization", organizationId, null)
      : coverageKeyFor("store", organizationId, String(store.storeId));
  return (
    licenses.find(
      (license) => license.coverageKey === key && license.organizationId === organizationId && license.status !== "cancelled"
    ) ?? null
  );
}

export type Coverage = { mode: LicensingMode; license: Doc | null };

/** A store's mode and covering license (null: Unlicensed). Pass the organization if it is at hand. */
export async function coverageFor(store: Doc, org?: Doc | null): Promise<Coverage> {
  await connectDb();
  const organizationId = String(store.organizationId);
  const [orgDoc, licenses] = (await Promise.all([
    org ?? OrganizationModel.findOne({ organizationId }).select("organizationId licensing").lean(),
    LicenseModel.find({
      coverageKey: {
        $in: [coverageKeyFor("organization", organizationId, null), coverageKeyFor("store", organizationId, String(store.storeId))]
      }
    }).lean()
  ])) as [Doc | null, Doc[]];
  const mode = modeOf(orgDoc ?? { organizationId }, licenses);
  return { mode, license: coveringFrom(mode, store, licenses) };
}

export async function coveringLicense(store: Doc, org?: Doc | null): Promise<Doc | null> {
  return (await coverageFor(store, org)).license;
}

/** Modes and non-cancelled licenses of many organizations, to answer coverage for many stores at once. */
export async function coverageIndex(filter: Doc = {}) {
  await connectDb();
  const [orgs, licenses] = (await Promise.all([
    OrganizationModel.find(filter).select("organizationId licensing").lean(),
    LicenseModel.find({ ...filter, coverageKey: { $type: "string" } }).lean()
  ])) as [Doc[], Doc[]];
  const byOrg = new Map<string, Doc[]>();
  for (const license of licenses) {
    const list = byOrg.get(String(license.organizationId)) ?? [];
    list.push(license);
    byOrg.set(String(license.organizationId), list);
  }
  const modes = new Map(orgs.map((org) => [String(org.organizationId), modeOf(org, byOrg.get(String(org.organizationId)) ?? [])]));
  const mode = (organizationId: string): LicensingMode => modes.get(organizationId) ?? "storeWise";
  return {
    licenses,
    mode,
    licensesOf: (organizationId: string) => byOrg.get(organizationId) ?? [],
    /** The master license of a master-mode organization, else null. */
    master: (organizationId: string) =>
      mode(organizationId) === "master"
        ? (byOrg.get(organizationId) ?? []).find((license) => license.scope === "organization") ?? null
        : null,
    licenseFor: (store: Doc) => coveringFrom(mode(String(store.organizationId)), store, byOrg.get(String(store.organizationId)) ?? [])
  };
}

/** Covering licenses for many stores, keyed by storeId. */
export async function coveringLicenses(stores: Doc[]): Promise<Map<string, Doc>> {
  const organizationIds = [...new Set(stores.map((store) => String(store.organizationId)))];
  if (!organizationIds.length) return new Map();
  const index = await coverageIndex({ organizationId: { $in: organizationIds } });
  const result = new Map<string, Doc>();
  for (const store of stores) {
    const license = index.licenseFor(store);
    if (license) result.set(String(store.storeId), license);
  }
  return result;
}

export type LicenseProblem = { code: "STORE_UNLICENSED" | "LICENSE_INACTIVE"; message: string };

/** Why a store is not entitled, in words an operator can act on; null when it is. */
export function licenseProblem(license: Doc | null, mode: LicensingMode = "storeWise", now = new Date()): LicenseProblem | null {
  if (!license) {
    return {
      code: "STORE_UNLICENSED",
      message:
        mode === "master"
          ? "This organization has no master license. Add one on the organization's Licenses tab."
          : "This store has no license. Issue it a store license on its License tab."
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

/** What a store view shows about its covering license. `scope` "organization" is the master license. */
export function licenseSummary(license: Doc | null | undefined) {
  if (!license) return null;
  return {
    licenseId: String(license.licenseId),
    licenseNumber: String(license.licenseNumber),
    scope: String(license.scope) as LicenseScope,
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
    scope: String(license.scope) as LicenseScope,
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
    /** Master: every store of the organization. Store license: its store. Cancelled: none. */
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

/** The master license created with a new organization, or when switching to master. */
export const MasterLicenseSchema = NewLicenseSchema;

export const LicenseCreateSchema = z
  .object({ scope: z.enum(["organization", "store"]), storeId: z.string().trim().min(1).max(80).optional(), ...newLicenseShape })
  .strict()
  .refine(oneEndDate, ONE_END_DATE)
  .refine((body) => (body.scope === "store" ? Boolean(body.storeId) : !body.storeId), {
    message: "a store license names its store; the master license names none",
    path: ["storeId"]
  });
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

/** `POST …/licensing/mode`. */
export const LicensingModeSchema = z
  .object({
    mode: z.enum(LICENSING_MODES),
    dryRun: z.boolean().optional(),
    /** master → storeWise: give every store a copy of the master (default), or leave them Unlicensed. */
    copyToStores: z.boolean().optional(),
    /** storeWise → master: the new master license. */
    master: MasterLicenseSchema.optional()
  })
  .strict();
export type LicensingModeChange = z.output<typeof LicensingModeSchema>;

// ── Writing ──────────────────────────────────────────────────────────────────

function duplicateOn(error: unknown, field: string): boolean {
  const record = error as { code?: unknown; keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
  return record?.code === 11000 && Boolean((record.keyPattern && field in record.keyPattern) || (record.keyValue && field in record.keyValue));
}

const MODE_LABEL: Record<LicensingMode, string> = { master: "on a master license", storeWise: "store-wise" };

export function modeMismatch(message: string, mode: LicensingMode): ControlPlaneError {
  return new ControlPlaneError(409, "LICENSE_MODE_MISMATCH", message, false, { licensingMode: mode });
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

/** A license document, without its id and number (given at insert). */
function licenseDoc(organizationId: string, scope: LicenseScope, storeId: string | null, input: NewLicense): Doc {
  return {
    organizationId,
    scope,
    ...(storeId ? { storeId } : {}),
    plan: input.plan,
    status: input.status ?? (input.plan === "trial" ? "trialing" : "active"),
    ...licenseTerms(input),
    offlineGraceDays: input.offlineGraceDays ?? DEFAULT_GRACE,
    maxStores: 1,
    maxPcsPerStore: input.maxPcsPerStore ?? DEFAULT_PCS,
    ...(input.notes ? { notes: input.notes } : {}),
    coverageKey: coverageKeyFor(scope, organizationId, storeId)
  };
}

async function insertLicense(doc: Doc): Promise<Doc> {
  await connectDb();
  const scope = doc.scope as LicenseScope;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await LicenseModel.create({ ...doc, licenseId: publicId("lic"), licenseNumber: newLicenseNumber(scope) });
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

/** The organization's licensing mode (read from the organization, pass it if at hand). */
export async function organizationMode(organizationId: string, org?: Doc | null): Promise<LicensingMode> {
  const doc = org ?? (await requireOrg(organizationId));
  const stored = storedMode(doc);
  if (stored) return stored;
  return (await LicenseModel.exists({ coverageKey: coverageKeyFor("organization", organizationId, null) })) ? "master" : "storeWise";
}

export async function masterLicense(organizationId: string): Promise<Doc | null> {
  await connectDb();
  return (await LicenseModel.findOne({ coverageKey: coverageKeyFor("organization", organizationId, null), organizationId }).lean()) as Doc | null;
}

async function ownStoreLicense(organizationId: string, storeId: string): Promise<Doc | null> {
  return (await LicenseModel.findOne({ coverageKey: coverageKeyFor("store", organizationId, storeId), organizationId }).lean()) as Doc | null;
}

async function storesOf(organizationId: string): Promise<CoveredStore[]> {
  const stores = (await TenantStoreModel.find({ organizationId }).select("storeId name").sort({ name: 1 }).lean()) as Doc[];
  return stores.map((store) => ({ storeId: String(store.storeId), name: String(store.name) }));
}

/** The stores a (non-cancelled) license covers under the current mode. */
async function coveredBy(license: Doc, mode: LicensingMode): Promise<CoveredStore[]> {
  if (license.status === "cancelled") return [];
  const organizationId = String(license.organizationId);
  if (license.scope === "organization") return mode === "master" ? storesOf(organizationId) : [];
  if (mode !== "storeWise") return [];
  const store = (await TenantStoreModel.findOne({ organizationId, storeId: license.storeId }).select("storeId name").lean()) as Doc | null;
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

/** Refuse a store license the organization's mode doesn't allow. */
async function assertStoreWise(organizationId: string, org?: Doc | null): Promise<void> {
  const mode = await organizationMode(organizationId, org);
  if (mode !== "storeWise") {
    throw modeMismatch(
      "This organization is on a master license that covers every store; store licenses are only for store-wise organizations.",
      mode
    );
  }
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
    license = await insertLicense(licenseDoc(organizationId, "store", store.storeId, input));
  } catch (error) {
    if (duplicateOn(error, "coverageKey")) throw storeLicenseExists(null);
    throw error;
  }
  await auditLicense(admin, "license.create", license, { plan: license.plan, entitlementExpiresAt: license.entitlementExpiresAt });
  scheduleNotify({ organizationId, storeId: store.storeId, reason: "store.license.change" });
  return licenseView(license, [store], store.name);
}

/**
 * `POST …/licenses`: the master license (master mode, none yet) or a store's
 * license (store-wise mode). Anything else is 409 LICENSE_MODE_MISMATCH.
 */
export async function createLicense(admin: InternalAdminActor, organizationId: string, body: LicenseCreate) {
  const org = await requireOrg(organizationId);
  if (body.scope === "store") {
    await assertStoreWise(organizationId, org);
    const store = (await TenantStoreModel.findOne({ organizationId, storeId: body.storeId }).select("storeId name").lean()) as Doc | null;
    if (!store) throw new ControlPlaneError(400, "STORE_UNKNOWN", "storeId: not a store of this organization");
    return issueStoreLicense(admin, organizationId, { storeId: String(store.storeId), name: String(store.name) }, body);
  }
  const mode = await organizationMode(organizationId, org);
  if (mode !== "master") {
    throw modeMismatch("This organization is store-wise: each store has its own license. Switch it to a master license instead.", mode);
  }
  const existing = await masterLicense(organizationId);
  if (existing) {
    throw modeMismatch(
      `This organization already has its master license (${String(existing.licenseNumber)}). Renew or edit it instead.`,
      mode
    );
  }
  let license: Doc;
  try {
    license = await insertLicense(licenseDoc(organizationId, "organization", null, body));
  } catch (error) {
    if (duplicateOn(error, "coverageKey")) throw modeMismatch("This organization already has its master license.", mode);
    throw error;
  }
  await auditLicense(admin, "license.create", license, { plan: license.plan, entitlementExpiresAt: license.entitlementExpiresAt });
  scheduleNotify({ organizationId, reason: "license.change" });
  return licenseView(license, await storesOf(organizationId));
}

/** The organization's mode and every license (cancelled ones too), the master first, each with the stores it covers. */
export async function listLicenses(organizationId: string): Promise<{ licensingMode: LicensingMode; licenses: LicenseView[] }> {
  const org = await requireOrg(organizationId);
  await expireLapsedLicenses({ organizationId });
  const [licenses, stores] = (await Promise.all([
    LicenseModel.find({ organizationId }).sort({ scope: 1, createdAt: -1 }).lean(),
    storesOf(organizationId)
  ])) as [Doc[], CoveredStore[]];
  const mode = modeOf(org, licenses.filter((license) => typeof license.coverageKey === "string"));
  const names = new Map(stores.map((store) => [store.storeId, store.name]));
  return {
    licensingMode: mode,
    licenses: licenses.map((license) => {
      const live = license.status !== "cancelled";
      const covered =
        !live
          ? []
          : license.scope === "organization"
            ? mode === "master"
              ? stores
              : []
            : mode === "storeWise" && names.has(String(license.storeId))
              ? [{ storeId: String(license.storeId), name: names.get(String(license.storeId))! }]
              : [];
      return licenseView(license, covered, license.storeId ? (names.get(String(license.storeId)) ?? null) : null);
    })
  };
}

/**
 * `PATCH …/licenses/{licenseId}`: plan, status (suspend / resume / cancel),
 * renew, end date, PCs per store (not below the busiest covered store), grace,
 * notes. A cancelled license is final; cancelling the master leaves every
 * store Unlicensed, cancelling a store license leaves its store Unlicensed.
 * A license that doesn't fit the organization's mode is 409
 * LICENSE_MODE_MISMATCH. Every store it covers is notified.
 */
export async function updateLicense(admin: InternalAdminActor, organizationId: string, licenseId: string, body: LicensePatch) {
  const org = await requireOrg(organizationId);
  const current = (await LicenseModel.findOne({ organizationId, licenseId }).lean()) as Doc | null;
  if (!current) throw notFound("License");
  if (current.status === "cancelled") {
    throw new ControlPlaneError(409, "LICENSE_CANCELLED", "A cancelled license can't be changed; create a new one.");
  }
  const mode = await organizationMode(organizationId, org);
  if ((mode === "master") !== (current.scope === "organization")) {
    throw modeMismatch(
      mode === "master"
        ? "This organization is on a master license; this store license covers nothing. Cancel it, or switch the organization to store-wise."
        : "This organization is store-wise; its old master license covers nothing. Cancel it, or switch the organization to a master license.",
      mode
    );
  }
  const covered = await coveredBy(current, mode);
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

/**
 * `PUT …/stores/{store}/license` — store-wise only (409 LICENSE_MODE_MISMATCH
 * on a master license): issue the store's license when it has none, else edit it.
 */
export async function upsertStoreLicense(admin: InternalAdminActor, organizationId: string, storeId: string, body: StoreLicenseBody) {
  const org = await requireOrg(organizationId);
  const store = (await TenantStoreModel.findOne({ organizationId, storeId }).select("storeId name").lean()) as Doc | null;
  if (!store) throw notFound("Store");
  await assertStoreWise(organizationId, org);
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

// ── Switching mode ───────────────────────────────────────────────────────────

type CoverageNote = {
  scope: LicenseScope;
  /** Null for a license the change would create (a dry run has no number yet). */
  licenseNumber: string | null;
  plan: string;
  status: string;
  entitlementExpiresAt: string | null;
};

const note = (license: Doc, numbered = true): CoverageNote => ({
  scope: String(license.scope) as LicenseScope,
  licenseNumber: numbered && license.licenseNumber ? String(license.licenseNumber) : null,
  plan: String(license.plan),
  status: String(license.status),
  entitlementExpiresAt: iso(license.entitlementExpiresAt)
});

const withNote = (existing: unknown, text: string) =>
  (typeof existing === "string" && existing.trim() ? `${existing.trim()}\n${text}` : text).slice(0, 1000);

export const SUPERSEDED_BY_MASTER = "superseded by master license";
const REPLACED_BY_STORE_LICENSES = "replaced by store licenses (switched to store-wise)";
const DROPPED_FOR_STORE_WISE = "cancelled when the organization switched to store-wise";

/**
 * `POST …/licensing/mode`: switch between master and store-wise.
 * - master → storeWise: each store gets a copy of the master (plan, status,
 *   end, grace, PCs) unless `copyToStores: false`; the master is cancelled.
 * - storeWise → master: `master` gives the new master's terms; every store
 *   license is cancelled, "superseded by master license".
 * `dryRun` answers the effect per store without writing. The real run is one
 * transaction, audited, and notifies every store. 409 LICENSING_MODE_UNCHANGED
 * when the organization is already in that mode.
 */
export async function changeLicensingMode(admin: InternalAdminActor, organizationId: string, body: LicensingModeChange) {
  const org = await requireOrg(organizationId);
  const from = await organizationMode(organizationId, org);
  const to = body.mode;
  if (from === to) {
    throw new ControlPlaneError(409, "LICENSING_MODE_UNCHANGED", `The organization is already ${MODE_LABEL[to]}.`);
  }
  if (to === "master" && !body.master) {
    throw new ControlPlaneError(400, "MASTER_LICENSE_REQUIRED", "master: give the new master license's plan and end date");
  }
  await expireLapsedLicenses({ organizationId });
  const [stores, live] = (await Promise.all([
    storesOf(organizationId),
    LicenseModel.find({ organizationId, coverageKey: { $type: "string" } }).lean()
  ])) as [CoveredStore[], Doc[]];
  const master = live.find((license) => license.scope === "organization") ?? null;
  const storeLicense = new Map(live.filter((license) => license.scope === "store").map((license) => [String(license.storeId), license]));
  const copyToStores = to === "storeWise" ? body.copyToStores !== false : false;

  const creates: Doc[] = [];
  const cancels: Array<{ license: Doc; reason: string }> = [];
  const rows: Array<{ storeId: string; name: string; before: CoverageNote | null; after: CoverageNote | null; createsLicense: boolean }> = [];

  if (to === "storeWise") {
    if (master) cancels.push({ license: master, reason: copyToStores ? REPLACED_BY_STORE_LICENSES : DROPPED_FOR_STORE_WISE });
    for (const store of stores) {
      const kept = storeLicense.get(store.storeId) ?? null;
      let after: Doc | null = kept;
      if (!kept && copyToStores && master) {
        after = {
          organizationId,
          scope: "store",
          storeId: store.storeId,
          plan: master.plan,
          status: master.status,
          startsAt: new Date(),
          entitlementExpiresAt: master.entitlementExpiresAt,
          offlineGraceDays: master.offlineGraceDays ?? DEFAULT_GRACE,
          maxStores: 1,
          maxPcsPerStore: master.maxPcsPerStore ?? DEFAULT_PCS,
          notes: `Copied from master license ${String(master.licenseNumber)}`,
          coverageKey: coverageKeyFor("store", organizationId, store.storeId)
        };
        creates.push(after);
      }
      rows.push({ storeId: store.storeId, name: store.name, before: master ? note(master) : null, after: after ? note(after, after === kept) : null, createsLicense: Boolean(after && after !== kept) });
    }
  } else {
    for (const license of live) cancels.push({ license, reason: SUPERSEDED_BY_MASTER });
    const doc = licenseDoc(organizationId, "organization", null, body.master!);
    creates.push(doc);
    for (const store of stores) {
      const before = storeLicense.get(store.storeId) ?? null;
      rows.push({ storeId: store.storeId, name: store.name, before: before ? note(before) : null, after: note(doc, false), createsLicense: false });
    }
  }

  const plan = {
    from,
    to,
    copyToStores,
    stores: rows,
    licenses: {
      created: creates.map((doc) => ({ ...note(doc, false), storeId: doc.storeId ? String(doc.storeId) : null })),
      cancelled: cancels.map(({ license, reason }) => ({
        licenseId: String(license.licenseId),
        licenseNumber: String(license.licenseNumber),
        scope: String(license.scope) as LicenseScope,
        storeId: license.storeId ? String(license.storeId) : null,
        reason
      }))
    }
  };
  if (body.dryRun) return { dryRun: true, ...plan };

  // One transaction: the mode, the cancellations, the new licenses.
  await LicenseModel.init();
  let inserted: Doc[] = [];
  for (let attempt = 0; ; attempt += 1) {
    const session = await startTransaction();
    try {
      const moved = await OrganizationModel.updateOne(
        { organizationId, $or: [{ "licensing.mode": from }, { "licensing.mode": { $exists: false } }] },
        { $set: { "licensing.mode": to } },
        withSession(session)
      );
      if (!moved.matchedCount) throw changedMeanwhile();
      for (const { license, reason } of cancels) {
        const done = await LicenseModel.updateOne(
          { licenseId: license.licenseId, coverageKey: { $type: "string" } },
          { $set: { status: "cancelled", notes: withNote(license.notes, reason) }, $unset: { coverageKey: 1 } },
          withSession(session)
        );
        if (!done.matchedCount) throw changedMeanwhile();
      }
      inserted = creates.map((doc) => ({
        ...doc,
        licenseId: publicId("lic"),
        licenseNumber: newLicenseNumber(doc.scope as LicenseScope)
      }));
      if (inserted.length) await LicenseModel.insertMany(inserted, withSession(session));
      await commitTransaction(session);
      break;
    } catch (error) {
      await abortTransaction(session);
      if (session && attempt < 2 && duplicateOn(error, "licenseNumber")) continue;
      if (duplicateOn(error, "coverageKey")) throw changedMeanwhile();
      throw error;
    }
  }

  const number = new Map(inserted.map((doc) => [String(doc.storeId ?? "master"), String(doc.licenseNumber)]));
  const newMaster = inserted.find((doc) => doc.scope === "organization") ?? null;
  await auditAdmin(admin, {
    organizationId,
    action: "organization.licensing.change",
    targetType: "organization",
    targetId: organizationId,
    metadata: {
      from,
      to,
      copyToStores,
      created: inserted.map((doc) => doc.licenseNumber),
      cancelled: cancels.map(({ license }) => license.licenseNumber)
    }
  });
  for (const { license, reason } of cancels) {
    await auditLicense(admin, "license.cancel", license, { reason, previousStatus: license.status });
  }
  for (const doc of inserted) {
    await auditLicense(admin, "license.create", doc, { plan: doc.plan, entitlementExpiresAt: doc.entitlementExpiresAt, reason: `licensing switched to ${to}` });
  }
  scheduleNotify({ organizationId, reason: "license.change" });

  return {
    dryRun: false,
    ...plan,
    stores: rows.map((row) => ({
      ...row,
      after: row.after
        ? { ...row.after, licenseNumber: row.after.licenseNumber ?? number.get(to === "master" ? "master" : row.storeId) ?? null }
        : null
    })),
    licenses: {
      ...plan.licenses,
      created: plan.licenses.created.map((entry) => ({
        ...entry,
        licenseNumber: number.get(entry.storeId ?? "master") ?? null
      }))
    },
    master: newMaster ? licenseView(newMaster, stores) : null
  };
}

function changedMeanwhile(): ControlPlaneError {
  return new ControlPlaneError(409, "LICENSING_MODE_CHANGED", "The organization's licenses changed meanwhile; review and try again.");
}
