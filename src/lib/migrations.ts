import { AppUserModel, TenantStoreModel, UserAssignmentModel } from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";

/**
 * Data migrations, run once per server process right after the database
 * connects (lib/db.ts). Each is idempotent: it only does work that has not
 * been done, so every instance can run it and a re-run changes nothing.
 * They use the models directly and never call connectDb (which awaits them).
 */

type Doc = Record<string, unknown>;

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

export type EmailIdentityReport = { verified: number; duplicates: number };

/**
 * Email is the identity now (D-18). Two things follow, both idempotent:
 *
 *   · Anyone who set their password from an invitation has already proved the
 *     address — the code only ever reached that inbox — so they are marked
 *     verified rather than asked to prove it again.
 *   · Duplicate addresses are counted and reported. There should be none: the
 *     collection has carried a unique index on email since before this, so a
 *     merge step exists only to say so out loud if one ever appears.
 */
export async function migrateEmailIdentity(): Promise<EmailIdentityReport> {
  const verified = await AppUserModel.updateMany(
    { status: "active", emailVerifiedAt: { $exists: false }, enrollmentConsumedAt: { $exists: true } },
    [{ $set: { emailVerifiedAt: "$enrollmentConsumedAt" } }],
    { updatePipeline: true }
  );
  const duplicates = await AppUserModel.aggregate([
    { $group: { _id: { $toLower: "$email" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "duplicates" }
  ]);
  return { verified: verified.modifiedCount ?? 0, duplicates: Number(duplicates[0]?.duplicates ?? 0) };
}

export type StoreAccessReport = { expanded: number; orphans: number };

/**
 * D-22: an assignment names a store, so the organization-wide row — one with no
 * `storeId`, which used to mean "every store, present and future" — is expanded
 * into one row per store of its organization and then deleted.
 *
 * Idempotent twice over: the source rows are gone after the first run, and each
 * new row goes in with the unique index's own key, so a row that already exists
 * for that person at that store is left exactly as it is — its role is the more
 * specific answer and always won before this too.
 *
 * An org-wide row whose organization has no stores has nothing to expand into.
 * It is counted as an orphan and deleted all the same: it granted nothing then
 * and would grant nothing now.
 */
export async function migrateStoreScopedAccess(): Promise<StoreAccessReport> {
  const orgWide = (await UserAssignmentModel.find({
    $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: "" }]
  }).lean()) as Array<Record<string, unknown>>;
  if (!orgWide.length) return { expanded: 0, orphans: 0 };

  const organizationIds = [...new Set(orgWide.map((row) => String(row.organizationId)))];
  const stores = (await TenantStoreModel.find({ organizationId: { $in: organizationIds } })
    .select("storeId organizationId")
    .lean()) as Array<Record<string, unknown>>;
  const byOrg = new Map<string, string[]>();
  for (const store of stores) {
    const key = String(store.organizationId);
    byOrg.set(key, [...(byOrg.get(key) ?? []), String(store.storeId)]);
  }

  let expanded = 0;
  let orphans = 0;
  for (const row of orgWide) {
    const storeIds = byOrg.get(String(row.organizationId)) ?? [];
    if (!storeIds.length) orphans += 1;
    for (const storeId of storeIds) {
      const key = {
        appUserId: String(row.appUserId),
        storeId,
        workerInstallationId: null
      };
      const already = await UserAssignmentModel.findOne(key).lean();
      if (already) continue;
      await UserAssignmentModel.create({
        ...key,
        assignmentId: publicId("assign"),
        organizationId: String(row.organizationId),
        role: String(row.role),
        scopes: Array.isArray(row.scopes) ? row.scopes : ["relay:request"],
        status: String(row.status ?? "active"),
        createdByAdminId: String(row.createdByAdminId ?? "")
      });
      expanded += 1;
    }
    await UserAssignmentModel.deleteOne({ assignmentId: row.assignmentId });
  }
  return { expanded, orphans };
}

export async function runMigrations(): Promise<void> {
  const identity = await migrateEmailIdentity();
  if (identity.verified > 0 || identity.duplicates > 0) {
    console.info(`[migrate] email identity: ${JSON.stringify(identity)}`);
  }

  const access = await migrateStoreScopedAccess();
  if (access.expanded > 0 || access.orphans > 0) {
    console.info(`[migrate] store-scoped access: ${JSON.stringify(access)}`);
  }

  const capabilities = await reportCapabilityDefaults();
  if (capabilities.looksUntouched > 0) {
    console.info(`[migrate] store capabilities (report only, nothing changed): ${JSON.stringify(capabilities)}`);
  }
}
