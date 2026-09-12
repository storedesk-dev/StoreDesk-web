import { z } from "zod";
import { connectDb } from "@/lib/db";
import { deleteCloudflareTunnel } from "@/lib/cloudflare";
import {
  SetupKeyModel,
  SubscriptionModel,
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
  ENTITLED_STATUSES,
  entitlementProblem,
  expireLapsedSubscriptions,
  subscriptionView
} from "@/lib/subscriptions";
import { provisionStoreTunnel, toDnsLabel, tunnelView, type TunnelOutcome } from "@/lib/tunnel";
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

export function storeView(store: Doc, installation?: Doc | null) {
  const settings = normalizeStoreSettings(store.settings);
  const tunnel = tunnelView(store);
  const register = readRegisterConfig(store.configJson);
  return {
    storeId: String(store.storeId),
    organizationId: String(store.organizationId),
    subscriptionId: String(store.subscriptionId),
    name: String(store.name),
    storeNumber: textOrNull(store.storeNumber),
    address: textOrNull(store.address),
    contactEmail: textOrNull(store.contactEmail),
    status: String(store.status ?? "active"),
    timeZone: settings.timeZone,
    capabilities: settings.capabilities,
    settingsVersion: readSettingsVersion(store),
    tunnel,
    /** Same as tunnel.url; kept for pages written before `tunnel`. */
    tunnelUrl: tunnel.url,
    register: { posIpAddress: register.posIpAddress, posUsername: register.posUsername },
    installation: installationSummary(installation),
    createdAt: iso(store.createdAt),
    updatedAt: iso(store.updatedAt)
  };
}

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
  const stores = (await TenantStoreModel.find({ organizationId }).sort({ name: 1 }).lean()) as Doc[];
  const installations = await primaryInstallations(stores.map((store) => String(store.storeId)));
  return stores.map((store) => storeView(store, installations.get(String(store.storeId)) ?? null));
}

export async function getStoreDetail(organizationId: string, storeId: string) {
  const store = await requireStore(organizationId, storeId);
  await expireLapsedSubscriptions({ organizationId, subscriptionId: store.subscriptionId });
  const [installations, subscription] = await Promise.all([
    primaryInstallations([storeId]),
    SubscriptionModel.findOne({ organizationId, subscriptionId: store.subscriptionId }).lean()
  ]);
  return {
    store: storeView(store, installations.get(storeId) ?? null),
    subscription: subscription ? subscriptionView(subscription as Doc) : null
  };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const timeZoneSchema = z
  .string()
  .trim()
  .refine(isValidTimeZone, "Unknown time zone; use an IANA name such as America/New_York");

export const StoreCreateSchema = z.object({
  subscriptionId: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(120),
  storeNumber: optionalText(40).optional(),
  address: optionalText(300).optional(),
  contactEmail: optionalEmail.optional(),
  timeZone: timeZoneSchema.nullish(),
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

export async function createStore(
  admin: InternalAdminActor,
  organizationId: string,
  body: StoreCreate
): Promise<{ store: ReturnType<typeof storeView>; tunnel: TunnelOutcome }> {
  const org = await requireOrganization(organizationId);
  if (org.status === "suspended") {
    throw new ControlPlaneError(409, "ORGANIZATION_SUSPENDED", "The organization is suspended; reactivate it first");
  }
  await expireLapsedSubscriptions({ organizationId });
  const subscription = (
    body.subscriptionId
      ? await SubscriptionModel.findOne({ organizationId, subscriptionId: body.subscriptionId }).lean()
      : await SubscriptionModel.findOne({ organizationId, status: { $in: ENTITLED_STATUSES } })
          .sort({ entitlementExpiresAt: -1 })
          .lean()
  ) as Doc | null;
  if (!subscription) {
    throw body.subscriptionId
      ? new ControlPlaneError(400, "SUBSCRIPTION_UNKNOWN", "subscriptionId: not a subscription of this organization")
      : new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "This organization has no active subscription; add one first");
  }
  const problem = entitlementProblem(subscription);
  if (problem) throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", problem);
  const subscriptionId = String(subscription.subscriptionId);
  const onSubscription = await TenantStoreModel.countDocuments({ organizationId, subscriptionId });
  if (onSubscription >= Number(subscription.maxStores)) {
    throw new ControlPlaneError(
      402,
      "STORE_LIMIT_REACHED",
      `This subscription allows ${String(subscription.maxStores)} stores and has ${onSubscription}; raise the limit first`
    );
  }

  const storeId = publicId("store");
  const settings: StoreSettings = { ...defaultStoreSettings(), timeZone: body.timeZone ?? null };
  const label =
    toDnsLabel(body.tunnelLabel ?? body.slug ?? "") ||
    toDnsLabel(`${String(org.slug)}-${body.name}`) ||
    toDnsLabel(`${String(org.slug)}-${body.storeNumber ?? ""}`) ||
    toDnsLabel(storeId);
  await TenantStoreModel.create({
    organizationId,
    storeId,
    subscriptionId,
    name: body.name,
    storeNumber: body.storeNumber ?? undefined,
    address: body.address ?? undefined,
    contactEmail: body.contactEmail ?? undefined,
    status: "active",
    settings,
    settingsVersion: 1,
    tunnelLabel: label,
    configJson: registerConfigJson({})
  });
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.create",
    targetType: "store",
    targetId: storeId,
    metadata: { name: body.name, subscriptionId }
  });
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
  return { store: storeView(store, null), tunnel };
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
  const installations = await primaryInstallations([storeId]);
  return storeView(after, installations.get(storeId) ?? null);
}

export async function deleteStore(admin: InternalAdminActor, organizationId: string, storeId: string) {
  const store = await requireStore(organizationId, storeId);
  const installations = (await WorkerInstallationModel.find({ organizationId, storeId })
    .select("workerInstallationId")
    .lean()) as Doc[];
  const installationIds = installations.map((row) => String(row.workerInstallationId));
  const assignments = (await UserAssignmentModel.find({ organizationId, storeId }).select("assignmentId").lean()) as Doc[];

  // Revoke first: the store's credentials are revoked and its server told,
  // before the tunnel the notify travels through is deleted. A failed revoke
  // throws and stops the delete.
  await revokeInstallationsAndNotify({ organizationId, storeId, reason: "store.delete" });

  const label = tunnelLabelOf(store);
  if (label) {
    try {
      await deleteCloudflareTunnel(label);
    } catch (error) {
      console.warn("[store.delete] tunnel:", error);
    }
  }

  await Promise.all([
    SetupKeyModel.deleteMany({ storeId }),
    WorkerCredentialModel.deleteMany({ workerInstallationId: { $in: installationIds } }),
    WorkerInstallationModel.deleteMany({ workerInstallationId: { $in: installationIds } }),
    UserAssignmentModel.deleteMany({ assignmentId: { $in: assignments.map((row) => String(row.assignmentId)) } })
  ]);
  await TenantStoreModel.deleteOne({ organizationId, storeId });
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.delete",
    targetType: "store",
    targetId: storeId,
    metadata: { name: store.name, installations: installationIds.length, assignments: assignments.length }
  });
  return { deleted: storeId };
}

/** Retry the tunnel (P6). 409 when the store already has one. */
export async function retryStoreTunnel(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  body: { label?: string }
) {
  const store = await requireStore(organizationId, storeId);
  if (store.tunnelUrl) {
    throw new ControlPlaneError(409, "TUNNEL_EXISTS", "This store already has a tunnel", false, {
      tunnel: tunnelView(store)
    });
  }
  const org = await requireOrganization(organizationId);
  const label =
    toDnsLabel(body.label ?? "") ||
    tunnelLabelOf(store) ||
    toDnsLabel(`${String(org.slug)}-${String(store.name)}`) ||
    toDnsLabel(storeId);
  const outcome = await provisionStoreTunnel(storeId, label);
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "store.tunnel.provision",
    targetType: "store",
    targetId: storeId,
    metadata: { status: outcome.status, label, retry: true, ...(outcome.status === "failed" ? { error: outcome.message } : {}) }
  });
  const tunnel = tunnelView(await requireStore(organizationId, storeId));
  if (outcome.status === "not_configured") {
    throw new ControlPlaneError(503, "TUNNEL_NOT_CONFIGURED", tunnel.message ?? "Cloudflare is not configured", false, { tunnel });
  }
  if (outcome.status === "failed") {
    throw new ControlPlaneError(502, "TUNNEL_PROVISION_FAILED", `Cloudflare refused the tunnel: ${outcome.message}`, true, {
      tunnel
    });
  }
  scheduleNotify({ organizationId, storeId, reason: "store.update" });
  return tunnel;
}

// ── Settings ─────────────────────────────────────────────────────────────────

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
