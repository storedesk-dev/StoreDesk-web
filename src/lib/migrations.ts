import { LegacySubscriptionModel, LicenseModel, OrganizationModel, TenantStoreModel } from "@/models/ControlPlane";
import { ENTITLED_STATUSES, SUPERSEDED_BY_MASTER, coverageKeyFor, newLicenseNumber } from "@/lib/licenses";
import { writeAudit } from "@/lib/audit";

/**
 * Data migrations, run once per server process right after the database
 * connects (lib/db.ts). Each is idempotent: it only does work that has not
 * been done, so every instance can run it and a re-run changes nothing.
 * They use the models directly and never call connectDb (which awaits them).
 */

type Doc = Record<string, unknown>;

const time = (value: unknown): number => (value ? new Date(String(value)).getTime() || 0 : 0);

const withNote = (existing: unknown, text: string) =>
  (typeof existing === "string" && existing.trim() ? `${existing.trim()}\n${text}` : text).slice(0, 1000);

/** The subscription that becomes the master license: not cancelled, in force, then the latest end, then the newest. */
function primaryFirst(a: Doc, b: Doc): number {
  const now = Date.now();
  const inForce = (sub: Doc) => (ENTITLED_STATUSES.includes(String(sub.status)) && time(sub.entitlementExpiresAt) > now ? 1 : 0);
  const notCancelled = (sub: Doc) => (sub.status === "cancelled" ? 0 : 1);
  return (
    notCancelled(b) - notCancelled(a) ||
    inForce(b) - inForce(a) ||
    time(b.entitlementExpiresAt) - time(a.entitlementExpiresAt) ||
    time(b.createdAt) - time(a.createdAt)
  );
}

async function insertLicense(doc: Doc): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await LicenseModel.create({ ...doc, licenseNumber: newLicenseNumber(doc.scope as "organization" | "store") });
      return true;
    } catch (error) {
      const record = error as { code?: number; keyPattern?: Record<string, unknown> };
      if (record.code !== 11000) throw error;
      if (record.keyPattern && "licenseNumber" in record.keyPattern) continue;
      // Another instance migrated the same subscription first.
      return false;
    }
  }
  throw new Error("Could not allocate a license number");
}

export type SubscriptionMigrationReport = { masterLicenses: number; cancelledLicenses: number };

/**
 * Subscriptions → licenses. Each subscription becomes a license with the same
 * id. Per organization, the best subscription not cancelled becomes the
 * master license (it covered the organization's stores; the master covers them
 * all); every other one becomes a cancelled license, kept for the record.
 */
export async function migrateSubscriptionsToLicenses(): Promise<SubscriptionMigrationReport> {
  const report: SubscriptionMigrationReport = { masterLicenses: 0, cancelledLicenses: 0 };
  const subs = (await LegacySubscriptionModel.find({}).lean()) as Doc[];
  if (!subs.length) return report;
  const done = new Set(
    ((await LicenseModel.find({ licenseId: { $in: subs.map((sub) => String(sub.subscriptionId)) } }).select("licenseId").lean()) as Doc[]).map(
      (license) => String(license.licenseId)
    )
  );
  const byOrg = new Map<string, Doc[]>();
  for (const sub of subs) {
    if (done.has(String(sub.subscriptionId))) continue;
    const list = byOrg.get(String(sub.organizationId)) ?? [];
    list.push(sub);
    byOrg.set(String(sub.organizationId), list);
  }

  for (const [organizationId, pending] of byOrg) {
    const masterKey = coverageKeyFor("organization", organizationId, null);
    let hasMaster = Boolean(await LicenseModel.exists({ coverageKey: masterKey }));
    for (const sub of [...pending].sort(primaryFirst)) {
      const base: Doc = {
        organizationId,
        licenseId: String(sub.subscriptionId),
        scope: "organization",
        plan: sub.plan ?? "standard",
        status: sub.status ?? "active",
        startsAt: sub.startsAt ?? sub.createdAt ?? new Date(),
        entitlementExpiresAt: sub.entitlementExpiresAt ?? new Date(),
        offlineGraceDays: typeof sub.offlineGraceDays === "number" ? Math.min(30, Math.max(0, sub.offlineGraceDays)) : 7,
        maxPcsPerStore: Math.max(1, Number(sub.maxWorkerInstallations) || 1),
        migratedFromSubscription: true
      };
      if (!hasMaster && sub.status !== "cancelled") {
        if (await insertLicense({ ...base, coverageKey: masterKey, notes: "Migrated from subscription" })) report.masterLicenses += 1;
        hasMaster = true;
        continue;
      }
      const why =
        sub.status === "cancelled"
          ? "Migrated from a cancelled subscription"
          : "Migrated from a second subscription; the master license covers its stores";
      if (await insertLicense({ ...base, status: "cancelled", notes: why })) report.cancelledLicenses += 1;
    }
  }
  return report;
}

export type ModeMigrationReport = { master: number; storeWise: number; supersededStoreLicenses: number; storesUnlinked: number };

/**
 * Give every organization its licensing mode:
 * - a non-cancelled organization license → master; its store licenses, if
 *   any, are cancelled ("superseded by master license") and audited;
 * - otherwise → store-wise (its store licenses, if any, cover their stores;
 *   stores without one are Unlicensed).
 * Then drop the per-store links older builds wrote: coverage is derived now.
 */
export async function migrateLicensingModes(): Promise<ModeMigrationReport> {
  const report: ModeMigrationReport = { master: 0, storeWise: 0, supersededStoreLicenses: 0, storesUnlinked: 0 };
  const orgs = (await OrganizationModel.find({ "licensing.mode": { $exists: false } }).select("organizationId").lean()) as Doc[];
  for (const org of orgs) {
    const organizationId = String(org.organizationId);
    const master = await LicenseModel.exists({ organizationId, coverageKey: coverageKeyFor("organization", organizationId, null) });
    if (master) {
      const stale = (await LicenseModel.find({ organizationId, scope: "store", coverageKey: { $type: "string" } }).lean()) as Doc[];
      for (const license of stale) {
        const cancelled = await LicenseModel.updateOne(
          { licenseId: license.licenseId, coverageKey: { $type: "string" } },
          { $set: { status: "cancelled", notes: withNote(license.notes, SUPERSEDED_BY_MASTER) }, $unset: { coverageKey: 1 } }
        );
        if (!cancelled.modifiedCount) continue;
        report.supersededStoreLicenses += 1;
        await writeAudit({
          organizationId,
          storeId: license.storeId ? String(license.storeId) : undefined,
          actorType: "system",
          actorId: "migration",
          action: "license.cancel",
          targetType: "license",
          targetId: String(license.licenseId),
          metadata: { licenseNumber: license.licenseNumber, scope: "store", reason: SUPERSEDED_BY_MASTER, previousStatus: license.status }
        });
      }
    }
    const mode = master ? "master" : "storeWise";
    const set = await OrganizationModel.updateOne(
      { organizationId, "licensing.mode": { $exists: false } },
      { $set: { "licensing.mode": mode } }
    );
    if (set.modifiedCount) report[mode] += 1;
  }
  const unlinked = await TenantStoreModel.collection.updateMany(
    { $or: [{ licenseId: { $exists: true } }, { subscriptionId: { $exists: true } }] },
    { $unset: { licenseId: "", subscriptionId: "" } }
  );
  report.storesUnlinked = unlinked.modifiedCount;
  return report;
}

export type CapabilityDefaultsReport = {
  stores: number;
  /** Every capability false and settings never saved (settingsVersion 1): the old default, not an answer. */
  looksUntouched: number;
  /** At least one capability not answered (missing or null): read as present. */
  notAnswered: number;
  /** Every capability true or false, saved at least once. */
  answered: number;
};

const CAPABILITY_KEYS = ["lottery", "coam", "fuel", "ebt", "moneyOrder", "prepaidGift"] as const;

/**
 * Report only: stores used to be created with every capability false, which
 * hid fuel (report mapping, the fuel pages) at stores that sell it. New stores
 * start "not answered" (null). Stored answers are never changed here: a false
 * that an admin saved and a false that was only the old default look the same
 * except for settingsVersion, so the admin confirms them on the store's
 * Features tab (which flags those stores).
 */
export async function reportCapabilityDefaults(): Promise<CapabilityDefaultsReport> {
  const report: CapabilityDefaultsReport = { stores: 0, looksUntouched: 0, notAnswered: 0, answered: 0 };
  const stores = (await TenantStoreModel.find({}).select("settings.capabilities settingsVersion").lean()) as Doc[];
  for (const store of stores) {
    report.stores += 1;
    const caps = ((store.settings as Doc | undefined)?.capabilities ?? {}) as Doc;
    const values = CAPABILITY_KEYS.map((key) => caps[key]);
    const version = typeof store.settingsVersion === "number" ? store.settingsVersion : 1;
    if (values.some((value) => typeof value !== "boolean")) report.notAnswered += 1;
    else if (version <= 1 && values.every((value) => value === false)) report.looksUntouched += 1;
    else report.answered += 1;
  }
  return report;
}

export async function runMigrations(): Promise<void> {
  const subscriptions = await migrateSubscriptionsToLicenses();
  if (Object.values(subscriptions).some((count) => count > 0)) {
    console.info(`[migrate] subscriptions → licenses: ${JSON.stringify(subscriptions)}`);
  }
  const modes = await migrateLicensingModes();
  if (Object.values(modes).some((count) => count > 0)) {
    console.info(`[migrate] licensing modes: ${JSON.stringify(modes)}`);
  }
  const capabilities = await reportCapabilityDefaults();
  if (capabilities.looksUntouched > 0) {
    console.info(`[migrate] store capabilities (report only, nothing changed): ${JSON.stringify(capabilities)}`);
  }
}
