import { AppUserModel, TenantStoreModel } from "@/models/ControlPlane";

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

export async function runMigrations(): Promise<void> {
  const identity = await migrateEmailIdentity();
  if (identity.verified > 0 || identity.duplicates > 0) {
    console.info(`[migrate] email identity: ${JSON.stringify(identity)}`);
  }

  const capabilities = await reportCapabilityDefaults();
  if (capabilities.looksUntouched > 0) {
    console.info(`[migrate] store capabilities (report only, nothing changed): ${JSON.stringify(capabilities)}`);
  }
}
