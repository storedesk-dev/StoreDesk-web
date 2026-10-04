import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";
import { coverageKeyFor, newLicenseNumber } from "@/lib/licenses";
import { writeAudit } from "@/lib/audit";
import { LOTTERY } from "@/lib/products";
import { rolesPersistingOrgAdmin, splitSettingsOutdated, type StoreRecord } from "@/lib/roles";

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

export type StoreRolesReport = { copied: number; seeded: number; alreadyHadRoles: number };

/**
 * D-22: roles hang off the store. Every store that has none of its own takes its organization's,
 * so a role somebody edited — a page turned on for Cashier, a role added — survives the move.
 *
 * A store whose organization has no roles either is left alone: `storedRoles` falls back to the
 * four templates on read, so it is never without them, and writing them here would only freeze a
 * copy that cannot then follow the registry.
 *
 * Idempotent: a store with roles is skipped and counted.
 */
export async function migrateStoreScopedRoles(): Promise<StoreRolesReport> {
  const stores = (await TenantStoreModel.find({}).select("storeId organizationId roles").lean()) as Array<
    Record<string, unknown>
  >;
  const needing = stores.filter((store) => !Array.isArray(store.roles) || store.roles.length === 0);
  if (!needing.length) return { copied: 0, seeded: 0, alreadyHadRoles: stores.length };

  const organizationIds = [...new Set(needing.map((store) => String(store.organizationId)))];
  const organizations = (await OrganizationModel.find({ organizationId: { $in: organizationIds } })
    .select("organizationId roles")
    .lean()) as Array<Record<string, unknown>>;
  const rolesOf = new Map(organizations.map((org) => [String(org.organizationId), org.roles]));

  let copied = 0;
  let seeded = 0;
  for (const store of needing) {
    const roles = rolesOf.get(String(store.organizationId));
    if (!Array.isArray(roles) || roles.length === 0) {
      seeded += 1;
      continue;
    }
    await TenantStoreModel.updateOne({ storeId: String(store.storeId) }, { $set: { roles } });
    copied += 1;
  }
  return { copied, seeded, alreadyHadRoles: stores.length - needing.length };
}

export type StoreLicenseReport = { issued: number; masters: number; alreadyCovered: number };

/**
 * D-22: a license covers a store, found by the coverage key `store:<storeId>`. A master license —
 * `scope: "organization"`, keyed `org:<organizationId>` — matches no store, so the moment S1
 * shipped every store covered only by one became **Unlicensed**: no setup key, no activation, and
 * `GET /edge/sync/access` answering 403 to the store PC.
 *
 * S1's note said `storeWise` was already the fallback so no live store changed behaviour. That was
 * wrong: the fallback decides what an organization *without* a stored mode does, not what happens
 * to a real master license row, and there was one in production covering a live store.
 *
 * So each live master is copied into a license per store of its organization, carrying its plan,
 * status, dates, grace and PC limit across, and the master row is left exactly as it is — it is
 * inert (no store key can ever match it) and it is the record of what the store used to hold.
 *
 * Idempotent: a store that already has its own non-cancelled license is left alone and counted,
 * and the unique index on `coverageKey` is the backstop if two instances race.
 */
export async function migrateStoreScopedLicenses(): Promise<StoreLicenseReport> {
  const masters = (await LicenseModel.find({
    coverageKey: { $regex: "^org:" },
    status: { $ne: "cancelled" }
  }).lean()) as Array<Record<string, unknown>>;
  if (!masters.length) return { issued: 0, masters: 0, alreadyCovered: 0 };

  let issued = 0;
  let alreadyCovered = 0;
  for (const master of masters) {
    const organizationId = String(master.organizationId);
    const stores = (await TenantStoreModel.find({ organizationId, status: { $ne: "closed" } })
      .select("storeId")
      .lean()) as Array<Record<string, unknown>>;

    for (const store of stores) {
      const storeId = String(store.storeId);
      const coverageKey = coverageKeyFor(storeId);
      const own = await LicenseModel.findOne({ coverageKey, status: { $ne: "cancelled" } }).lean();
      if (own) {
        alreadyCovered += 1;
        continue;
      }
      try {
        await LicenseModel.create({
          licenseId: publicId("lic"),
          licenseNumber: newLicenseNumber(),
          organizationId,
          scope: "store",
          storeId,
          coverageKey,
          plan: master.plan,
          status: master.status,
          startsAt: master.startsAt,
          entitlementExpiresAt: master.entitlementExpiresAt,
          offlineGraceDays: master.offlineGraceDays,
          maxPcsPerStore: master.maxPcsPerStore,
          notes: `Issued from ${String(master.licenseNumber)} when licensing moved to one per store (D-22).`
        });
        issued += 1;
      } catch (error) {
        // The unique coverageKey index: another instance got there first, which is the right answer.
        if (!String((error as { message?: string }).message ?? "").includes("duplicate key")) throw error;
        alreadyCovered += 1;
      }
    }
  }
  return { issued, masters: masters.length, alreadyCovered };
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
      try {
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
      } catch (error) {
        // Several instances cold-start at once and all run this. The unique index on
        // (appUserId, storeId, workerInstallationId) settles it: whoever lost already wrote the
        // row this one wanted, so that is the right answer, not a failure to retry the whole run.
        if (!String((error as { message?: string }).message ?? "").includes("duplicate key")) throw error;
      }
    }
    await UserAssignmentModel.deleteOne({ assignmentId: row.assignmentId });
  }
  return { expanded, orphans };
}

export type LotterySignInReport = { keys: number; credentials: number; installations: number; activeBefore: number };

export const D26_REASON = "d26_lottery_sign_in";

/**
 * `2026-09-29-lottery-sign-in` (D-26, docs/design/lottery-sign-in.md §6). StoreDesk Lottery signs in
 * with email and password now, so everything the old chain issued is revoked:
 *
 *   1. Count the live lottery installations first, for the audit line (expected zero: the access
 *      sync refused every lottery credential, so no PC could finish the old setup).
 *   2. Every lottery setup key — issued for lottery, or for a lottery installation — is revoked.
 *   3. Every worker credential of a lottery installation is revoked.
 *   4. Every lottery installation is revoked, and its store's projection version goes up, so the
 *      hourly reconcile pushes a projection whose revocation list names it.
 *   5. (In `redeemSetupKey`, not here: a non-StoreDesk installation's key is refused WRONG_PRODUCT.)
 *   6. One audit line with the counts, only when something changed.
 *
 * Idempotent: every step filters on what is not revoked yet, so a second run changes nothing.
 */
export async function migrateLotterySignIn(): Promise<LotterySignInReport> {
  const now = new Date();
  const installations = (await WorkerInstallationModel.find({ product: LOTTERY })
    .select("workerInstallationId storeId status")
    .lean()) as Doc[];
  const ids = installations.map((row) => String(row.workerInstallationId));
  const activeBefore = installations.filter((row) => row.status === "active").length;

  const keys = await SetupKeyModel.updateMany(
    {
      status: { $ne: "revoked" },
      $or: [{ deliveryReason: "lottery_setup" }, ...(ids.length ? [{ workerInstallationId: { $in: ids } }] : [])]
    },
    { $set: { status: "revoked", revokedAt: now, revokedReason: D26_REASON } }
  );
  const credentials = ids.length
    ? await WorkerCredentialModel.updateMany(
        { workerInstallationId: { $in: ids }, status: { $ne: "revoked" } },
        { $set: { status: "revoked", revokedAt: now, revokedReason: D26_REASON } }
      )
    : { modifiedCount: 0 };
  const live = installations.filter((row) => row.status !== "revoked");
  const retired = live.length
    ? await WorkerInstallationModel.updateMany(
        { product: LOTTERY, status: { $ne: "revoked" } },
        { $set: { status: "revoked", revokedAt: now }, $unset: { workerCredentialId: 1 } }
      )
    : { modifiedCount: 0 };
  const storeIds = [...new Set(live.map((row) => String(row.storeId ?? "")).filter(Boolean))];
  if (storeIds.length) await TenantStoreModel.updateMany({ storeId: { $in: storeIds } }, { $inc: { projectionVersion: 1 } });

  const report: LotterySignInReport = {
    keys: Number(keys.modifiedCount ?? 0),
    credentials: Number(credentials.modifiedCount ?? 0),
    installations: Number(retired.modifiedCount ?? 0),
    activeBefore
  };
  if (report.keys || report.credentials || report.installations) {
    await writeAudit({
      actorType: "system",
      actorId: "migration",
      action: "lottery.d26_migrated",
      targetType: "migration",
      targetId: "2026-09-29-lottery-sign-in",
      metadata: report
    });
  }
  return report;
}

export type NoTrialReport = { trialing: number; trialPlans: number };

/**
 * D-23: a licence is granted by us for the agreed term, and a new store is Unlicensed — there is no
 * automatic trial nobody granted. Records written before that may still say status `trialing` or
 * plan `trial`; they read as active until their end date already, and this makes the record say so:
 *
 *   · status `trialing` → `active`
 *   · plan `trial` → `standard`
 *
 * Dates are left exactly as they are, so nobody gains or loses a day: a trialing licence past its
 * end becomes active here and `expireLapsedLicenses` marks it expired on the next read, as it would
 * have been. The store PCs accept both statuses, so nothing is pushed to them.
 *
 * Idempotent: each update filters on the old value, so a second run changes nothing.
 */
export async function migrateNoTrial(): Promise<NoTrialReport> {
  const trialing = await LicenseModel.updateMany({ status: "trialing" }, { $set: { status: "active" } });
  const trialPlans = await LicenseModel.updateMany({ plan: "trial" }, { $set: { plan: "standard" } });
  const report: NoTrialReport = {
    trialing: Number(trialing.modifiedCount ?? 0),
    trialPlans: Number(trialPlans.modifiedCount ?? 0)
  };
  if (report.trialing || report.trialPlans) {
    await writeAudit({
      actorType: "system",
      actorId: "migration",
      action: "license.d23_no_trial",
      targetType: "migration",
      targetId: "2026-09-30-no-trial",
      metadata: report
    });
  }
  return report;
}

export type SplitSettingsReport = { stores: number; migrated: number };

/**
 * 2026-10-03: Sales Tax (`salesTax`) and Store settings (`storeSettings`) left the always-on Settings
 * page, so Cashier and Viewer stop reaching sales tax, bank accounts and the register login. Every
 * store whose stored roles predate them is written once with the roles as they now read
 * (`resolveSplitSettingsPages` in lib/roles.ts: owners and managers keep both, the rest get them
 * switched off), each changed role one version up so the store PC takes it at its next sync.
 *
 * Reads already resolve the same way, so this only saves the answer. Idempotent: a store whose roles
 * all name both keys is skipped; a lost compare-and-set is left for the next read or run.
 */
export async function migrateSplitSettingsPages(): Promise<SplitSettingsReport> {
  const stores = (await TenantStoreModel.find({}).select("storeId roles updatedAt createdAt").lean()) as Doc[];
  let migrated = 0;
  for (const store of stores) {
    if (!splitSettingsOutdated(store.roles)) continue;
    await rolesPersistingOrgAdmin(String(store.storeId), store as StoreRecord);
    migrated += 1;
  }
  return { stores: stores.length, migrated };
}

export async function runMigrations(): Promise<void> {
  const identity = await migrateEmailIdentity();
  if (identity.verified > 0 || identity.duplicates > 0) {
    console.info(`[migrate] email identity: ${JSON.stringify(identity)}`);
  }

  const roles = await migrateStoreScopedRoles();
  if (roles.copied > 0) {
    console.info(`[migrate] store-scoped roles: ${JSON.stringify(roles)}`);
  }

  // After the copy above, so a store that just took its organization's roles is split too.
  const split = await migrateSplitSettingsPages();
  if (split.migrated > 0) {
    console.info(`[migrate] 2026-10-03-split-settings: ${JSON.stringify(split)}`);
  }

  const licenses = await migrateStoreScopedLicenses();
  if (licenses.issued > 0 || licenses.masters > 0) {
    console.info(`[migrate] store-scoped licenses: ${JSON.stringify(licenses)}`);
  }

  // After the master copy above, which carries a master's plan and status across.
  const noTrial = await migrateNoTrial();
  if (noTrial.trialing || noTrial.trialPlans) {
    console.info(`[migrate] 2026-09-30-no-trial: ${JSON.stringify(noTrial)}`);
  }

  const access = await migrateStoreScopedAccess();
  if (access.expanded > 0 || access.orphans > 0) {
    console.info(`[migrate] store-scoped access: ${JSON.stringify(access)}`);
  }

  const lottery = await migrateLotterySignIn();
  if (lottery.keys || lottery.credentials || lottery.installations) {
    console.info(`[migrate] 2026-09-29-lottery-sign-in: ${JSON.stringify(lottery)}`);
  }

  const capabilities = await reportCapabilityDefaults();
  if (capabilities.looksUntouched > 0) {
    console.info(`[migrate] store capabilities (report only, nothing changed): ${JSON.stringify(capabilities)}`);
  }
}
