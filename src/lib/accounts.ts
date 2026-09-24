import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  LicenseModel,
  LoginThrottleModel,
  TenantStoreModel,
  UserAssignmentModel
} from "@/models/ControlPlane";
import {
  ControlPlaneError,
  hashSecret,
  publicId,
  randomSecret,
  sha256,
  verifySecret
} from "@/lib/control-plane-security";
import { isEntitled } from "@/lib/licenses";
import { readOrganizationRoles } from "@/lib/roles";
import { writeAudit } from "@/lib/audit";
import { scheduleAppUserNotify } from "@/lib/store-notify";
import type { App } from "@/config/pages";

/**
 * One account per person, and what that account can reach.
 *
 * Email is the identity (D-18): unique across the whole system, normalized
 * lowercase, and nobody types an organization tag any more. A person signs in
 * with email and password and is answered with the stores they can reach, as a
 * flat list — one store goes straight in, several show a picker. There is no
 * grouping above a store any more (D-22).
 *
 * What this is not: a session. The control plane says who someone is and what
 * they may reach; a StoreDesk app still signs in at its own store server
 * (`lib/legacy-sign-in.ts` keeps the old routes 410), and the lottery product
 * takes a token from here in P2. Nothing in this file mints one yet.
 */

type Doc = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const iso = (value: unknown): string | null => (value ? new Date(String(value)).toISOString() : null);

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);
/** Long enough to be worth having, short enough that a store PC's keyboard is not the enemy. */
export const PasswordSchema = z.string().min(8).max(200);

export interface ReachableStore {
  readonly storeId: string;
  readonly name: string;
  readonly storeNumber: string | null;
  readonly timeZone: string | null;
  readonly status: string;
  readonly role: { readonly roleId: string; readonly roleName: string | null };
  /** What the role grants, per app, so a picker can grey out a store the person cannot work in. */
  readonly pages: Partial<Readonly<Record<App, readonly string[]>>>;
  readonly lottery: { readonly sells: boolean };
  readonly licence: { readonly covered: boolean; readonly status: string | null; readonly expiresAt: string | null };
}

export interface Account {
  readonly appUserId: string;
  readonly email: string;
  readonly name: string | null;
  readonly status: string;
  readonly emailVerified: boolean;
}

/**
 * Which stores this person can reach, flat, with the role that applies at each.
 *
 * Every assignment names a store (D-22), so there is nothing to resolve: one
 * row, one store. A tie — the same store twice, which the unique index should
 * prevent — goes to the lowest `assignmentId`, the same tie-break the access
 * sync uses (`lib/access-sync.ts`), so a picker and a store server never
 * disagree about someone's role.
 */
export async function reachableFor(appUserId: string): Promise<ReachableStore[]> {
  await connectDb();
  const assignments = (await UserAssignmentModel.find({ appUserId, status: "active" }).lean()) as Doc[];
  if (!assignments.length) return [];

  const byStore = new Map<string, Doc>();
  for (const assignment of assignments) {
    const storeId = text(assignment.storeId);
    if (!storeId) continue;
    const current = byStore.get(storeId);
    if (!current || text(assignment.assignmentId) < text(current.assignmentId)) byStore.set(storeId, assignment);
  }
  if (!byStore.size) return [];

  const storeIds = [...byStore.keys()];
  const [stores, licences] = (await Promise.all([
    TenantStoreModel.find({ storeId: { $in: storeIds }, status: { $ne: "closed" } }).lean(),
    LicenseModel.find({ storeId: { $in: storeIds }, status: { $ne: "cancelled" } }).lean()
  ])) as [Doc[], Doc[]];

  // Roles are still written on the organization (they move to the store in S6),
  // so they are read per organization and applied per store.
  const organizationIds = [...new Set(stores.map((store) => text(store.organizationId)).filter(Boolean))];
  const roleNames = new Map<string, Map<string, string>>();
  const rolePages = new Map<string, Map<string, Record<string, string[]>>>();
  for (const organizationId of organizationIds) {
    const roles = (await readOrganizationRoles(organizationId)) ?? [];
    roleNames.set(organizationId, new Map(roles.map((role) => [role.roleId, role.roleName])));
    rolePages.set(
      organizationId,
      new Map(
        roles.map((role) => [
          role.roleId,
          Object.fromEntries(
            Object.entries(role.accessKeys ?? {}).map(([app, keys]) => [
              app,
              (keys?.pages ?? []).filter((page) => page.enabled).map((page) => page.key)
            ])
          ) as Record<string, string[]>
        ])
      )
    );
  }

  const byId = new Map(licences.map((licence) => [text(licence.storeId), licence]));
  const reachable: ReachableStore[] = [];
  for (const store of stores) {
    const storeId = text(store.storeId);
    const assignment = byStore.get(storeId);
    if (!assignment) continue;
    const organizationId = text(store.organizationId);

    const roleId = text(assignment.role);
    const settings = (store.settings as Doc | undefined) ?? {};
    const capabilities = (settings.capabilities as Doc | undefined) ?? {};
    const covering = byId.get(storeId) ?? null;

    reachable.push({
      storeId,
      name: text(store.name),
      storeNumber: store.storeNumber ? text(store.storeNumber) : null,
      timeZone: settings.timeZone ? text(settings.timeZone) : null,
      status: text(store.status),
      role: { roleId, roleName: roleNames.get(organizationId)?.get(roleId) ?? null },
      pages: (rolePages.get(organizationId)?.get(roleId) ?? {}) as Partial<Record<App, string[]>>,
      lottery: { sells: capabilities.lottery === true },
      licence: {
        covered: covering !== null && isEntitled(covering),
        status: covering ? text(covering.status) : null,
        expiresAt: covering ? iso(covering.entitlementExpiresAt) : null
      }
    });
  }
  return reachable.sort((a, b) => a.name.localeCompare(b.name));
}

// ── signing in ───────────────────────────────────────────────────────────────

const WINDOW_MS = 15 * 60_000;
export const ATTEMPTS_PER_IP = 20;
export const ATTEMPTS_PER_EMAIL = 5;

/**
 * Count one attempt in the current window, atomically, so every instance sees
 * the same number and parallel attempts cannot slip past the limit. The same
 * shape the staff login uses (`lib/admin-auth.ts`), against its own keys.
 */
async function countAttempt(key: string, now: Date): Promise<number> {
  const expires = new Date(now.getTime() + WINDOW_MS);
  const live = { $gt: ["$expiresAt", now] };
  for (let attempt = 0; ; attempt += 1) {
    try {
      const doc = await LoginThrottleModel.collection.findOneAndUpdate(
        { key },
        [{ $set: { count: { $cond: [live, { $add: ["$count", 1] }, 1] }, expiresAt: { $cond: [live, "$expiresAt", expires] } } }],
        { upsert: true, returnDocument: "after" }
      );
      return Number(doc?.count ?? 1);
    } catch (error) {
      if ((error as { code?: number }).code === 11000 && attempt === 0) continue;
      throw error;
    }
  }
}

let dummyHash: Promise<string> | null = null;
/** Verify against something for an unknown email too, so a wrong one takes as long as a right one. */
const unknownAccountHash = (): Promise<string> => (dummyHash ??= hashSecret(randomSecret(16)));

export interface SignInResult {
  readonly user: Account;
  readonly stores: readonly ReachableStore[];
}

/**
 * Email and password, no organization tag. One answer for a wrong password and
 * an unknown email, so neither can be used to probe for the other, and a
 * lockout that is counted before the password is checked.
 */
export async function signIn(input: { email: string; password: string; ip?: string }): Promise<SignInResult> {
  await connectDb();
  const email = normalizeEmail(input.email);
  const ip = input.ip ?? "unknown";
  const ipHash = sha256(ip).slice(0, 16);
  const ipKey = `app-login:ip:${sha256(ip)}`;
  const emailKey = `app-login:email:${sha256(email)}`;
  const now = new Date();

  const [ipCount, emailCount] = await Promise.all([countAttempt(ipKey, now), countAttempt(emailKey, now)]);
  if (ipCount > ATTEMPTS_PER_IP || emailCount > ATTEMPTS_PER_EMAIL) {
    throw new ControlPlaneError(429, "LOGIN_RATE_LIMITED", "Too many sign-in attempts. Wait 15 minutes and try again.", true);
  }

  const user = await AppUserModel.findOne({ email }).select("+passwordHash");
  const valid = user?.passwordHash
    ? await verifySecret(String(user.passwordHash), input.password)
    : (await verifySecret(await unknownAccountHash(), input.password), false);

  if (!user || !valid) {
    await writeAudit({
      actorType: "system",
      actorId: "app_login",
      action: "app_user.login_failed",
      targetType: "app_user",
      targetId: user ? text(user.appUserId) : email,
      metadata: { email, ipHash }
    });
    throw new ControlPlaneError(401, "LOGIN_INVALID", "That email and password don't match");
  }

  if (user.status === "pending_enrollment") {
    throw new ControlPlaneError(409, "ACCOUNT_NOT_SET_UP", "Finish setting up this account from the invitation email first");
  }
  if (user.status !== "active") {
    throw new ControlPlaneError(403, "ACCOUNT_DISABLED", "This account has been turned off. Ask your manager.");
  }

  await LoginThrottleModel.deleteMany({ key: { $in: [ipKey, emailKey] } });
  user.lastLoginAt = now;
  await user.save();
  await writeAudit({
    actorType: "app_user",
    actorId: text(user.appUserId),
    action: "app_user.login",
    targetType: "app_user",
    targetId: text(user.appUserId),
    metadata: { ipHash }
  });

  return { user: account(user as unknown as Doc), stores: await reachableFor(text(user.appUserId)) };
}

const account = (user: Doc): Account => ({
  appUserId: text(user.appUserId),
  email: text(user.email),
  name: user.name ? text(user.name) : null,
  status: text(user.status),
  emailVerified: Boolean(user.emailVerifiedAt)
});

// ── the password, and the email behind it ────────────────────────────────────

const RESET_MINUTES = 60;
const VERIFY_HOURS = 72;

/** `<appUserId>.<secret>`, and only the hash of the secret is ever stored. */
function credential(appUserId: string): { credential: string; secret: string } {
  const secret = randomSecret(24);
  return { credential: `${appUserId}.${secret}`, secret };
}

function split(raw: string): { appUserId: string; secret: string } {
  const [appUserId, secret, extra] = raw.split(".");
  if (!appUserId || !secret || extra) throw new ControlPlaneError(401, "RESET_INVALID", "That link is not valid any more");
  return { appUserId, secret };
}

/**
 * Start a reset. Always answers the same, whether or not the email is one we
 * know: a reset form that says "no such account" is an account list.
 */
export async function requestPasswordReset(rawEmail: string): Promise<{ credential: string; email: string; name: string | null } | null> {
  await connectDb();
  const email = normalizeEmail(rawEmail);
  const user = await AppUserModel.findOne({ email });
  if (!user || user.status === "disabled") return null;

  const { credential: token, secret } = credential(text(user.appUserId));
  user.resetSecretHash = await hashSecret(secret);
  user.resetExpiresAt = new Date(Date.now() + RESET_MINUTES * 60_000);
  user.resetConsumedAt = undefined;
  await user.save();
  await writeAudit({
    actorType: "app_user",
    actorId: text(user.appUserId),
    action: "app_user.password_reset_requested",
    targetType: "app_user",
    targetId: text(user.appUserId)
  });
  return { credential: token, email, name: user.name ? text(user.name) : null };
}

/** Finish a reset. Single use, an hour to use it, and the old password stops working at once. */
export async function resetPassword(rawCredential: string, password: string): Promise<Account> {
  await connectDb();
  const { appUserId, secret } = split(rawCredential);
  const user = await AppUserModel.findOne({ appUserId }).select("+resetSecretHash +passwordHash");
  const invalid = new ControlPlaneError(401, "RESET_INVALID", "That link is not valid any more");
  if (!user || !user.resetSecretHash || !(await verifySecret(String(user.resetSecretHash), secret))) throw invalid;
  if (user.resetConsumedAt) throw new ControlPlaneError(409, "RESET_CONSUMED", "That link has already been used");
  if (user.resetExpiresAt && user.resetExpiresAt.getTime() <= Date.now()) {
    throw new ControlPlaneError(410, "RESET_EXPIRED", "That link has expired. Ask for a new one.");
  }
  if (user.status === "disabled") throw invalid;

  user.passwordHash = await hashSecret(password);
  user.passwordChangedAt = new Date();
  user.passwordSetBy = "user";
  user.resetConsumedAt = new Date();
  user.resetSecretHash = undefined;
  if (user.status === "pending_enrollment") user.status = "active";
  await user.save();

  await writeAudit({
    actorType: "app_user",
    actorId: appUserId,
    action: "app_user.password_reset",
    targetType: "app_user",
    targetId: appUserId
  });
  // The new password reaches this person's stores with their next access pull.
  scheduleAppUserNotify(appUserId, "app_user.enroll");
  return account(user as unknown as Doc);
}

/** Start email verification. The address is the identity now, so it is worth proving once. */
export async function requestEmailVerification(appUserId: string): Promise<{ credential: string; email: string } | null> {
  await connectDb();
  const user = await AppUserModel.findOne({ appUserId });
  if (!user || user.emailVerifiedAt) return null;

  const { credential: token, secret } = credential(appUserId);
  user.verificationSecretHash = await hashSecret(secret);
  user.verificationExpiresAt = new Date(Date.now() + VERIFY_HOURS * 3_600_000);
  await user.save();
  return { credential: token, email: text(user.email) };
}

export async function verifyEmail(rawCredential: string): Promise<Account> {
  await connectDb();
  const { appUserId, secret } = split(rawCredential);
  const user = await AppUserModel.findOne({ appUserId }).select("+verificationSecretHash");
  const invalid = new ControlPlaneError(401, "VERIFICATION_INVALID", "That link is not valid any more");
  if (!user) throw invalid;
  if (user.emailVerifiedAt) return account(user as unknown as Doc);
  if (!user.verificationSecretHash || !(await verifySecret(String(user.verificationSecretHash), secret))) throw invalid;
  if (user.verificationExpiresAt && user.verificationExpiresAt.getTime() <= Date.now()) {
    throw new ControlPlaneError(410, "VERIFICATION_EXPIRED", "That link has expired. Ask for a new one.");
  }

  user.emailVerifiedAt = new Date();
  user.verificationSecretHash = undefined;
  await user.save();
  await writeAudit({
    actorType: "app_user",
    actorId: appUserId,
    action: "app_user.email_verified",
    targetType: "app_user",
    targetId: appUserId
  });
  return account(user as unknown as Doc);
}

/** Every id this account can be addressed by, for the P2 projection into Supabase. */
export { publicId as newAccountId };
