import { LegacySubscriptionModel, LicenseModel, TenantStoreModel } from "@/models/ControlPlane";
import { ENTITLED_STATUSES, coverageKeyFor, newLicenseNumber } from "@/lib/licenses";

/**
 * Data migrations, run once per server process right after the database
 * connects (lib/db.ts). Each is idempotent: it only does work that has not
 * been done, so every instance can run it and a re-run changes nothing.
 * They use the models directly and never call connectDb (which awaits them).
 */

type Doc = Record<string, unknown>;

export type LicenseMigrationReport = {
  organizationLicenses: number;
  storeLicenses: number;
  merged: number;
  storesLinked: number;
  storesUnlicensed: number;
};

const time = (value: unknown): number => (value ? new Date(String(value)).getTime() || 0 : 0);

/** The subscription that becomes an organization's license: in force first, then the latest end, then the newest. */
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

/**
 * Subscriptions → licenses (docs/design/control-plane-admin.md, "Licenses").
 * Each subscription becomes a license with the same id, and each store's
 * `subscriptionId` becomes its `licenseId`, so nothing a store covers changes.
 *
 * An organization may have had several subscriptions in force, but may have
 * only one organization license. The one in force with the latest end becomes
 * the organization license. Another one in force that covers exactly one
 * store becomes that store's store license; one covering several stores is
 * cancelled and its stores move onto the organization license, whose seats
 * grow to fit. Cancelled subscriptions become cancelled licenses.
 */
export async function migrateSubscriptionsToLicenses(): Promise<LicenseMigrationReport> {
  const report: LicenseMigrationReport = { organizationLicenses: 0, storeLicenses: 0, merged: 0, storesLinked: 0, storesUnlicensed: 0 };
  const subs = (await LegacySubscriptionModel.find({}).lean()) as Doc[];
  const redirect = new Map<string, string>();

  if (subs.length) {
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
      const existing = (await LicenseModel.findOne({ coverageKey: coverageKeyFor("organization", organizationId, null) }).lean()) as Doc | null;
      let primaryId = existing ? String(existing.licenseId) : null;
      for (const sub of [...pending].sort(primaryFirst)) {
        const licenseId = String(sub.subscriptionId);
        const base: Doc = {
          organizationId,
          licenseId,
          plan: sub.plan ?? "standard",
          status: sub.status ?? "active",
          startsAt: sub.startsAt ?? sub.createdAt ?? new Date(),
          entitlementExpiresAt: sub.entitlementExpiresAt ?? new Date(),
          offlineGraceDays: typeof sub.offlineGraceDays === "number" ? Math.min(30, Math.max(0, sub.offlineGraceDays)) : 7,
          maxPcsPerStore: Math.max(1, Number(sub.maxWorkerInstallations) || 1),
          migratedFromSubscription: true
        };
        const onIt = { organizationId, $or: [{ licenseId }, { licenseId: { $exists: false }, subscriptionId: licenseId }] };

        if (sub.status === "cancelled") {
          if (await insertLicense({ ...base, scope: "organization", maxStores: Math.max(1, Number(sub.maxStores) || 1), notes: "Migrated from a cancelled subscription" })) {
            report.organizationLicenses += 1;
          }
          continue;
        }
        if (!primaryId) {
          if (
            await insertLicense({
              ...base,
              scope: "organization",
              maxStores: Math.max(1, Number(sub.maxStores) || 1),
              coverageKey: coverageKeyFor("organization", organizationId, null),
              notes: "Migrated from subscription"
            })
          ) {
            report.organizationLicenses += 1;
          }
          primaryId = licenseId;
          continue;
        }
        // A second subscription still in force.
        const stores = (await TenantStoreModel.find(onIt).select("storeId").lean()) as Doc[];
        const onlyStore = stores.length === 1 ? String(stores[0].storeId) : null;
        if (onlyStore && !(await LicenseModel.exists({ coverageKey: coverageKeyFor("store", organizationId, onlyStore) }))) {
          if (
            await insertLicense({
              ...base,
              scope: "store",
              storeId: onlyStore,
              maxStores: 1,
              coverageKey: coverageKeyFor("store", organizationId, onlyStore),
              notes: "Migrated from a second subscription"
            })
          ) {
            report.storeLicenses += 1;
          }
          continue;
        }
        await insertLicense({
          ...base,
          status: "cancelled",
          scope: "organization",
          maxStores: Math.max(1, Number(sub.maxStores) || 1),
          notes: "Migrated from a second subscription; its stores moved to the organization license"
        });
        report.merged += 1;
        redirect.set(licenseId, primaryId);
        await TenantStoreModel.updateMany(onIt, { $set: { licenseId: primaryId } });
        // The primary's own stores may not be linked yet (only `subscriptionId`): count them too.
        const used = await TenantStoreModel.countDocuments({
          organizationId,
          $or: [{ licenseId: primaryId }, { licenseId: { $exists: false }, subscriptionId: primaryId }]
        });
        await LicenseModel.updateOne({ licenseId: primaryId, maxStores: { $lt: used } }, { $set: { maxStores: used } });
      }
    }
  }

  // Link every store not linked yet: its subscription's license, or none.
  const unlinked = (await TenantStoreModel.find({ licenseId: { $exists: false } }).select("storeId subscriptionId").lean()) as Doc[];
  if (unlinked.length) {
    const ids = unlinked.map((store) => store.subscriptionId).filter((id): id is string => typeof id === "string" && Boolean(id));
    const statuses = new Map(
      ((await LicenseModel.find({ licenseId: { $in: [...ids, ...redirect.values()] } }).select("licenseId status").lean()) as Doc[]).map(
        (license) => [String(license.licenseId), String(license.status)]
      )
    );
    for (const store of unlinked) {
      const from = typeof store.subscriptionId === "string" ? store.subscriptionId : "";
      const candidate = redirect.get(from) ?? from;
      const target = candidate && statuses.has(candidate) && statuses.get(candidate) !== "cancelled" ? candidate : null;
      const result = await TenantStoreModel.updateOne(
        { storeId: store.storeId, licenseId: { $exists: false } },
        { $set: { licenseId: target } }
      );
      if (result.modifiedCount) {
        if (target) report.storesLinked += 1;
        else report.storesUnlicensed += 1;
      }
    }
  }
  return report;
}

export async function runMigrations(): Promise<void> {
  const report = await migrateSubscriptionsToLicenses();
  if (Object.values(report).some((count) => count > 0)) {
    console.info(`[migrate] subscriptions → licenses: ${JSON.stringify(report)}`);
  }
}
