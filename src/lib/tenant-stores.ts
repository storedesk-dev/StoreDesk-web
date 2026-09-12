import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  LicenseModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { notFound, optionalEmail, optionalText } from "@/lib/http";
import { toIsoOr } from "@/lib/roles";
import { requireOrganization, tunnelLabelOf } from "@/lib/organizations";
import { revokeInstallationsAndNotify, scheduleNotify } from "@/lib/store-notify";
import {
  applySettingsUpdate,
  defaultStoreSettings,
  isValidTimeZone,
  normalizeStoreSettings,
  readSettingsVersion,
  type StoreSettings,
  type StoreSettingsUpdate
} from "@/lib/store-settings";
import {
  CoverageSchema,
  coveringLicense,
  coveringLicenseId,
  coveringLicenses,
  expireLapsedLicenses,
  giveStoreOwnLicense,
  licenseSummary,
  prepareNewStoreCoverage,
  seatsFull,
  seatsUsed,
  seatsWithinLimit
} from "@/lib/licenses";
import {
  freeTunnelLabel,
  provisionStoreTunnel,
  removeStoreTunnel,
  rotateStoreTunnel,
  toDnsLabel,
  tunnelLabelInUse,
  tunnelView,
  type TunnelOutcome
} from "@/lib/tunnel";
import { googleServiceAccountEmail } from "@/lib/google";
import type { InternalAdminActor } from "@/lib/admin-auth";

type Doc = Record<string, unknown>;

// ── Register connection (configJson, P2 / P17) ───────────────────────────────

export type RegisterConfig = { posIntegration: "verifone_commander"; posIpAddress: string; posUsername: string };

/** The register fields of a stored configJson; anything else in it is ignored. */
export function readRegisterConfig(configJson: unknown): RegisterConfig {
  let parsed: Doc = {};
  if (typeof configJson === "string" && configJson.trim()) {
    try {
      const value = JSON.parse(configJson);
      if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Doc;
    } catch {
      /* an unparseable stored config reads as empty */
    }
  }
  return {
    posIntegration: "verifone_commander",
    posIpAddress: typeof parsed.posIpAddress === "string" ? parsed.posIpAddress : "",
    posUsername: typeof parsed.posUsername === "string" ? parsed.posUsername : ""
  };
}

/**
 * configJson is built here and only here: the register connection, nothing
 * else — no roles (access sync is the one channel, P17), no feature flags, and
 * never the register password (its own encrypted field).
 */
export function registerConfigJson(values: Partial<RegisterConfig>): string {
  const config: RegisterConfig = {
    posIntegration: "verifone_commander",
    posIpAddress: values.posIpAddress ?? "",
    posUsername: values.posUsername ?? ""
  };
  return JSON.stringify(config, null, 2);
}

// ── Views ────────────────────────────────────────────────────────────────────

const iso = (value: unknown): string | null => (value ? toIsoOr(value, "") || null : null);
const textOrNull = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

export function installationSummary(installation: Doc | null | undefined) {
  if (!installation) return null;
  return {
    workerInstallationId: String(installation.workerInstallationId),
    status: String(installation.status),
    activatedAt: iso(installation.activatedAt),
    lastSeenAt: iso(installation.lastSeenAt),
    platform: textOrNull(installation.platform),
    workerVersion: textOrNull(installation.workerVersion),
    workerName: textOrNull(installation.workerName)
  };
}

/** `license` is the store's covering license (already checked to cover it), or null: Unlicensed. */
export function storeView(store: Doc, installation?: Doc | null, license?: Doc | null) {
  const settings = normalizeStoreSettings(store.settings);
  const tunnel = tunnelView(store);
  const register = readRegisterConfig(store.configJson);
  return {
    storeId: String(store.storeId),
    organizationId: String(store.organizationId),
    name: String(store.name),
    storeNumber: textOrNull(store.storeNumber),
    address: textOrNull(store.address),
    contactEmail: textOrNull(store.contactEmail),
    status: String(store.status ?? "active"),
    timeZone: settings.timeZone,
    capabilities: settings.capabilities,
    settingsVersion: readSettingsVersion(store),
    /** The covering license, or null: Unlicensed (the PC can't activate and sign-in is refused). */
    licenseId: license ? String(license.licenseId) : null,
    license: licenseSummary(license),
    tunnel,
    /** Same as tunnel.url; kept for pages written before `tunnel`. */
    tunnelUrl: tunnel.url,
    register: { posIpAddress: register.posIpAddress, posUsername: register.posUsername },
    installation: installationSummary(installation),
    createdAt: iso(store.createdAt),
    updatedAt: iso(store.updatedAt)
  };
}
export type StoreView = ReturnType<typeof storeView>;

/** The store's current PC: the most recently created installation. */
async function primaryInstallations(storeIds: string[]): Promise<Map<string, Doc>> {
  if (!storeIds.length) return new Map();
  const rows = (await WorkerInstallationModel.find({ storeId: { $in: storeIds } })
    .sort({ createdAt: -1 })
    .lean()) as Doc[];
  const map = new Map<string, Doc>();
  for (const row of rows) {
    const storeId = String(row.storeId);
    if (!map.has(storeId)) map.set(storeId, row);
  }
  return map;
}

export async function requireStore(organizationId: string, storeId: string): Promise<Doc> {
  await connectDb();
  const store = (await TenantStoreModel.findOne({ organizationId, storeId }).lean()) as Doc | null;
  if (!store) throw notFound("Store");
  return store;
}

export async function listStores(organizationId: string) {
  await requireOrganization(organizationId);
  await expireLapsedLicenses({ organizationId });
  const stores = (await TenantStoreModel.find({ organizationId }).sort({ name: 1 }).lean()) as Doc[];
  const [installations, licenses] = await Promise.all([
    primaryInstallations(stores.map((store) => String(store.storeId))),
    coveringLicenses(stores)
  ]);
  return stores.map((store) =>
    storeView(store, installations.get(String(store.storeId)) ?? null, licenses.get(String(store.storeId)) ?? null)
  );
}

export async function getStoreDetail(organizationId: string, storeId: string) {
  await expireLapsedLicenses({ organizationId });
  const store = await requireStore(organizationId, storeId);
  const [installations, license] = await Promise.all([primaryInstallations([storeId]), coveringLicense(store)]);
  return {
    store: storeView(store, installations.get(storeId) ?? null, license),
    license: licenseSummary(license)
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const timeZoneSchema = z
  .string()
  .trim()
  .refine(isValidTimeZone, "Unknown time zone; use an IANA name such as America/New_York");

export const StoreCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  storeNumber: optionalText(40).optional(),
  address: optionalText(300).optional(),
  contactEmail: optionalEmail.optional(),
  timeZone: timeZoneSchema.nullish(),
  /**
   * Coverage: `organization` (a seat on the organization license — the
   * default), `store` with `newLicense` (its own license), or `none`.
   */
  license: CoverageSchema.optional(),
  /** The tunnel hostname label; defaults to `<org tag>-<store name>`. `slug` is the older name. */
  tunnelLabel: z.string().trim().max(63).optional(),
  slug: z.string().trim().max(63).optional()
});
export type StoreCreate = z.output<typeof StoreCreateSchema>;

export const StorePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    storeNumber: optionalText(40).optional(),
    address: optionalText(300).optional(),
    contactEmail: optionalEmail.optional(),
    status: z.enum(["active", "suspended", "closed"]).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" });
export type StorePatch = z.output<typeof StorePatchSchema>;

// ── Writes ───────────────────────────────────────────────────────────────────

function labelTaken(label: string): ControlPlaneError {
  return new ControlPlaneError(409, "TUNNEL_LABEL_TAKEN", `The tunnel name "${label}" is already used by another store`);
}

export async function createStore(
  admin: InternalAdminActor,
  organizationId: string,
  body: StoreCreate
): Promise<{ store: StoreView; tunnel: TunnelOutcome }> {
  const org = await requireOrganization(organizationId);
  if (org.status === "suspended") {
    throw new ControlPlaneError(409, "ORGANIZATION_SUSPENDED", "The organization is suspended; reactivate it first");
  }
  await expireLapsedLicenses({ organizationId });
  const coverage = await prepareNewStoreCoverage(organizationId, body.license);

  const storeId = publicId("store");
  // A label the operator chose must be free; a derived one gets -2, -3, … .
  const explicit = toDnsLabel(body.tunnelLabel ?? body.slug ?? "");
  if (explicit && (await tunnelLabelInUse(explicit, storeId))) throw labelTaken(explicit);
  const label =
    explicit ||
    (await freeTunnelLabel(
      toDnsLabel(`${String(org.slug)}-${body.name}`) ||
        toDnsLabel(`${String(org.slug)}-${body.storeNumber ?? ""}`) ||
        toDnsLabel(storeId),
      storeId
    ));
  const settings: StoreSettings = { ...defaultStoreSettings(), timeZone: body.timeZone ?? null };
  await TenantStoreModel.create({
    organizationId,
    storeId,
    name: body.name,
    storeNumber: body.storeNumber ?? undefined,
    address: body.address ?? undefined,
    contactEmail: body.contactEmail ?? undefined,
    status: "active",
    settings,
    settingsVersion: 1,
    licenseId: coverage.license ? String(coverage.license.licenseId) : null,
    // The tunnel label is saved only once a tunnel exists under it.
    configJson: registerConfigJson({})
  });
  if (coverage.license && !(await seatsWithinLimit(coverage.license))) {
    // A concurrent change took the last seat.
    await TenantStoreModel.deleteOne({ storeId });
    throw seatsFull(coverage.license, await seatsUsed(String(coverage.license.licenseId)));
  }
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.create",
    targetType: "store",
    targetId: storeId,
    metadata: {
      name: body.name,
      licenseMode: coverage.mode,
      ...(coverage.license ? { licenseId: coverage.license.licenseId, licenseNumber: coverage.license.licenseNumber } : {})
    }
  });
  if (coverage.newLicense) await giveStoreOwnLicense(admin, organizationId, storeId, coverage.newLicense, null);

  const tunnel = await provisionStoreTunnel(storeId, label);
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.tunnel.provision",
    targetType: "store",
    targetId: storeId,
    metadata: { status: tunnel.status, label, ...(tunnel.status === "failed" ? { error: tunnel.message } : {}) }
  });
  const store = await requireStore(organizationId, storeId);
  return { store: storeView(store, null, await coveringLicense(store)), tunnel };
}

export async function updateStore(admin: InternalAdminActor, organizationId: string, storeId: string, body: StorePatch) {
  const before = await requireStore(organizationId, storeId);
  const set: Doc = {};
  const unset: Doc = {};
  for (const key of ["name", "storeNumber", "address", "contactEmail", "status"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (value === null) unset[key] = 1;
    else set[key] = value;
  }
  const after = (await TenantStoreModel.findOneAndUpdate(
    { organizationId, storeId },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after", runValidators: true }
  ).lean()) as Doc;
  const changed = Object.keys(body).filter((key) => String(before[key] ?? "") !== String(after[key] ?? ""));
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.update",
    targetType: "store",
    targetId: storeId,
    metadata: { changed, ...(changed.includes("status") ? { status: after.status, previousStatus: before.status } : {}) }
  });
  // Name, number and status are in the store's access sync; a suspension
  // makes its next pull answer 403 STORE_SUSPENDED.
  if (changed.length) scheduleNotify({ organizationId, storeId, reason: "store.update" });
  const [installations, license] = await Promise.all([primaryInstallations([storeId]), coveringLicense(after)]);
  return storeView(after, installations.get(storeId) ?? null, license);
}

export async function deleteStore(admin: InternalAdminActor, organizationId: string, storeId: string) {
  const store = await requireStore(organizationId, storeId);
  const installations = (await WorkerInstallationModel.find({ organizationId, storeId })
    .select("workerInstallationId")
    .lean()) as Doc[];
  const installationIds = installations.map((row) => String(row.workerInstallationId));
  const assignments = (await UserAssignmentModel.find({ organizationId, storeId }).select("assignmentId").lean()) as Doc[];
  const ownLicenses = (await LicenseModel.find({ organizationId, scope: "store", storeId }).select("licenseId licenseNumber").lean()) as Doc[];

  // Revoke first: the store's credentials are revoked and its server told,
  // before the tunnel the notify travels through is deleted. A failed revoke
  // throws and stops the delete.
  await revokeInstallationsAndNotify({ organizationId, storeId, reason: "store.delete" });

  // By the stored Cloudflare ids only.
  const tunnel = await removeStoreTunnel(store);

  await Promise.all([
    SetupKeyModel.deleteMany({ storeId }),
    WorkerCredentialModel.deleteMany({ workerInstallationId: { $in: installationIds } }),
    WorkerInstallationModel.deleteMany({ workerInstallationId: { $in: installationIds } }),
    UserAssignmentModel.deleteMany({ assignmentId: { $in: assignments.map((row) => String(row.assignmentId)) } }),
    // A store license covers nothing without its store. An organization-license
    // seat frees itself: seats are counted from the stores.
    LicenseModel.deleteMany({ licenseId: { $in: ownLicenses.map((row) => String(row.licenseId)) } })
  ]);
  await TenantStoreModel.deleteOne({ organizationId, storeId });
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.delete",
    targetType: "store",
    targetId: storeId,
    metadata: {
      name: store.name,
      installations: installationIds.length,
      assignments: assignments.length,
      licenseId: coveringLicenseId(store),
      storeLicensesDeleted: ownLicenses.map((row) => row.licenseNumber),
      tunnelDeleted: tunnel.tunnelDeleted,
      ...(tunnel.manualCleanup ? { tunnelNeedsManualCleanup: tunnel.manualCleanup } : {})
    }
  });
  return { deleted: storeId, ...(tunnel.manualCleanup ? { tunnelNeedsManualCleanup: tunnel.manualCleanup } : {}) };
}

/**
 * Retry the tunnel (P6), or rotate a live one:
 * - no tunnel: create it (a label the operator chose must be free);
 * - a tunnel with a stored Cloudflare id: rotate its secret — after Replace PC
 *   this is what cuts the old PC off — audited `store.tunnel.rotate`;
 * - an older tunnel known only by its name: create a replacement under a new
 *   name. The old one is left for manual cleanup (deleting by name is unsafe)
 *   and named in the audit.
 * 503 TUNNEL_NOT_CONFIGURED and 502 TUNNEL_PROVISION_FAILED carry the current `tunnel`.
 */
export async function retryStoreTunnel(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  body: { label?: string }
) {
  const store = await requireStore(organizationId, storeId);
  const org = await requireOrganization(organizationId);
  let outcome: TunnelOutcome;
  let action: string;
  const metadata: Doc = {};
  if (store.tunnelUrl && store.tunnelId) {
    outcome = await rotateStoreTunnel(storeId, String(store.tunnelId));
    action = "store.tunnel.rotate";
    metadata.tunnelId = store.tunnelId;
    metadata.afterReplacePc = store.tunnelRotationRequired === true;
  } else {
    const explicit = toDnsLabel(body.label ?? "");
    const legacy = store.tunnelUrl ? tunnelLabelOf(store) : null;
    // An older tunnel keeps its name until removed by hand, so even this
    // store's own label counts as taken.
    const exceptStoreId = legacy ? "" : storeId;
    if (explicit && (await tunnelLabelInUse(explicit, exceptStoreId))) throw labelTaken(explicit);
    const label =
      explicit ||
      (await freeTunnelLabel(toDnsLabel(`${String(org.slug)}-${String(store.name)}`) || toDnsLabel(storeId), exceptStoreId));
    outcome = await provisionStoreTunnel(storeId, label);
    action = "store.tunnel.provision";
    Object.assign(metadata, { label, retry: true, ...(legacy ? { replacedLegacyTunnel: legacy, tunnelNeedsManualCleanup: legacy } : {}) });
  }
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action,
    targetType: "store",
    targetId: storeId,
    metadata: { ...metadata, status: outcome.status, ...(outcome.status === "failed" ? { error: outcome.message } : {}) }
  });
  const tunnel = tunnelView(await requireStore(organizationId, storeId));
  if (outcome.status === "not_configured") {
    throw new ControlPlaneError(503, "TUNNEL_NOT_CONFIGURED", outcome.message ?? "Cloudflare is not configured", false, { tunnel });
  }
  if (outcome.status === "failed") {
    const what = action === "store.tunnel.rotate" ? "rotate the tunnel" : "create the tunnel";
    throw new ControlPlaneError(502, "TUNNEL_PROVISION_FAILED", `Cloudflare refused to ${what}: ${outcome.message}`, true, {
      tunnel
    });
  }
  scheduleNotify({ organizationId, storeId, reason: "store.update" });
  return tunnel;
}

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * One Google Sheet belongs to one organization: StoreDesk's account can open
 * every sheet shared with it, so letting a second organization attach the
 * same sheet would hand it the first one's data. 409 SHEET_IN_USE.
 */
export async function assertSheetNotInOtherOrganization(organizationId: string, spreadsheetId: string): Promise<void> {
  await connectDb();
  const used = await TenantStoreModel.exists({
    "settings.integrations.googleSheets.spreadsheetId": spreadsheetId,
    organizationId: { $ne: organizationId }
  });
  if (used) {
    throw new ControlPlaneError(
      409,
      "SHEET_IN_USE",
      "This sheet is already connected to another organization's store. Each organization needs its own sheet."
    );
  }
}

export async function getStoreSettings(organizationId: string, storeId: string) {
  const store = await requireStore(organizationId, storeId);
  return {
    settings: normalizeStoreSettings(store.settings),
    settingsVersion: readSettingsVersion(store),
    googleClientEmail: googleServiceAccountEmail()
  };
}

/**
 * Save settings on top of the version the caller read (P2): 409
 * SETTINGS_VERSION_CONFLICT with the current settings when someone saved in
 * between. An update that changes nothing writes nothing.
 */
export async function updateStoreSettings(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  update: StoreSettingsUpdate,
  baseVersion: number | undefined
) {
  if (baseVersion === undefined) {
    throw new ControlPlaneError(
      428,
      "SETTINGS_VERSION_REQUIRED",
      "Send the settingsVersion you read (in the body or as If-Match)"
    );
  }
  const store = await requireStore(organizationId, storeId);
  const current = normalizeStoreSettings(store.settings);
  const version = readSettingsVersion(store);
  const conflict = () =>
    new ControlPlaneError(409, "SETTINGS_VERSION_CONFLICT", "These settings changed since you opened them; review and save again", false, {
      settings: current,
      settingsVersion: version
    });
  if (baseVersion !== version) throw conflict();

  const { settings, changed } = applySettingsUpdate(current, update);
  if (changed.length === 0) {
    return { settings: current, settingsVersion: version, googleClientEmail: googleServiceAccountEmail() };
  }
  const spreadsheetId = settings.integrations.googleSheets.spreadsheetId;
  if (changed.includes("integrations") && spreadsheetId) {
    await assertSheetNotInOtherOrganization(organizationId, spreadsheetId);
  }
  const versionFilter = version === 1 ? { $in: [1, null] } : version;
  const written = await TenantStoreModel.updateOne(
    { organizationId, storeId, settingsVersion: versionFilter },
    { $set: { settings, settingsVersion: version + 1 } }
  );
  if (written.matchedCount === 0) {
    const latest = await requireStore(organizationId, storeId);
    throw new ControlPlaneError(409, "SETTINGS_VERSION_CONFLICT", "These settings changed since you opened them; review and save again", false, {
      settings: normalizeStoreSettings(latest.settings),
      settingsVersion: readSettingsVersion(latest)
    });
  }
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.settings.update",
    targetType: "store",
    targetId: storeId,
    metadata: { changed, settingsVersion: version + 1, capabilities: settings.capabilities }
  });
  scheduleNotify({ organizationId, storeId, reason: "store.settings.update" });
  return { settings, settingsVersion: version + 1, googleClientEmail: googleServiceAccountEmail() };
}
