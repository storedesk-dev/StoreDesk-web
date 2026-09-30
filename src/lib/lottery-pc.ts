import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  LotteryPcModel,
  LotterySignInTicketModel,
  TenantStoreModel
} from "@/models/ControlPlane";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/audit";
import { coverageFor, expireLapsedLicenses, isEntitled, licenseProblem } from "@/lib/licenses";
import { requireStore } from "@/lib/tenant-stores";
import { normalizeStoreSettings } from "@/lib/store-settings";
import { EmailSchema, reachableFor, signIn, type ReachableStore } from "@/lib/accounts";
import {
  checkRefreshCredential,
  issueRefreshFamily,
  revokeRefreshFamilies,
  rotateRefreshCredential
} from "@/lib/lottery-refresh";
import { isSupabaseConfigured, lotteryWords, mintSupabaseToken, readSupabaseToken, type SupabaseClaims } from "@/lib/supabase-token";
import { publishableCloud, readStoreHealth, scheduleProjectionPush } from "@/lib/supabase-admin";
import { readJson } from "@/lib/http";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * StoreDesk Lottery PCs sign in like everything else: email and password (D-18, D-26).
 *
 * There is no setup key, no claim, no org tag and no device credential. A person signs in; the
 * control plane checks the password (`accounts.signIn`, with its lockout and audit), and answers
 * with the stores that person may run lottery at. The first person on a PC picks the store and the
 * PC is bound to it (`LotteryPc`); after that the PC works for that store, and every cloud token it
 * holds is a **person's** token for that store, rotated through a refresh credential that lives
 * sealed on the PC. Design: docs/design/lottery-sign-in.md.
 *
 * The control plane is the only judge of who may use a store (`whyBlocked` plus the role's lottery
 * pages). The lottery app renders the answer and decides nothing.
 */

type Doc = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const iso = (value: unknown): string | null => (value ? new Date(String(value)).toISOString() : null);

export const OFFLINE_MAX_AGE_DAYS = 30;
const TICKET_MS = 5 * 60_000;

/** The lottery app's own page keys. */
const LOTTERY_KEYS = new Set(["lottery", "lotteryClose", "lotteryCorrect", "lotteryReports", "lotterySettings"]);

// ── why a store cannot run lottery ───────────────────────────────────────────

export type Blocked = { status: number; code: string; message: string };

/**
 * Why a store cannot run StoreDesk Lottery, in words the lottery app shows as they are. The only
 * source of a greyed picker row, and of the refusal when a bound PC signs in.
 */
export function whyBlocked(store: Doc, license: Doc | null): Blocked | null {
  // Only the store's own status blocks it (D-22).
  if (store.status !== "active") {
    return { status: 409, code: "STORE_SUSPENDED", message: `This store is ${text(store.status)}.` };
  }
  // One switch (D-24): a store that sells lottery runs StoreDesk Lottery.
  if (normalizeStoreSettings(store.settings).capabilities.lottery !== true) {
    return {
      status: 409,
      code: "STORE_NO_LOTTERY",
      message: "This store isn't set up for lottery. Ask your StoreDesk contact to switch it on."
    };
  }
  const problem = licenseProblem(license);
  if (problem) {
    // The admin wording names the licence number and the admin tab; a counter PC gets plain words.
    const message =
      problem.code === "STORE_UNLICENSED" ? "This store has no StoreDesk licence." : "This store's StoreDesk licence isn't active.";
    return { status: 402, code: problem.code, message };
  }
  return null;
}

export const NO_LOTTERY_PAGES: Blocked = {
  status: 403,
  code: "NO_LOTTERY_PAGES",
  message: "Your role can't use StoreDesk Lottery here."
};

/** A store, its covering licence, and whether it can run lottery — or 404/the block. */
export async function loadStore(storeId: string) {
  const store = await requireStore(storeId);
  await expireLapsedLicenses({ organizationId: text(store.organizationId) });
  const coverage = await coverageFor(store);
  const blocked = whyBlocked(store, coverage.license);
  if (blocked) throw new ControlPlaneError(blocked.status, blocked.code, blocked.message);
  return { store, organizationId: text(store.organizationId), coverage };
}

/** The role's lottery pages: the lottery app's keys (older roles kept some under `electron`). */
export function lotteryPagesOf(pages: ReachableStore["pages"]): string[] {
  const keys = [...(pages.lottery ?? []), ...(pages.electron ?? [])].filter((key) => LOTTERY_KEYS.has(key));
  return lotteryWords("lottery", keys);
}

// ── shapes ───────────────────────────────────────────────────────────────────

const personView = (user: Doc) => ({
  appUserId: text(user.appUserId),
  email: text(user.email),
  name: user.name ? text(user.name) : null,
  status: text(user.status),
  passwordChangedAt: iso(user.passwordChangedAt)
});

const licenceView = (license: Doc | null) => ({
  covered: isEntitled(license),
  status: license ? text(license.status) : null,
  expiresAt: license ? iso(license.entitlementExpiresAt) : null
});

const storeView = (store: Doc, license: Doc | null) => ({
  storeId: text(store.storeId),
  name: text(store.name),
  storeNumber: store.storeNumber ? text(store.storeNumber) : null,
  timeZone: normalizeStoreSettings(store.settings).timeZone,
  licence: licenceView(license)
});

const refused = (blocked: Blocked) => new ControlPlaneError(blocked.status, blocked.code, blocked.message);
const noAccess = () => new ControlPlaneError(403, "NO_LOTTERY_ACCESS", "You can't use StoreDesk Lottery at this store.");
const notBound = () =>
  new ControlPlaneError(409, "PC_NOT_BOUND", "This PC is not the store's lottery PC. Pick the store again.");
const replaced = () => new ControlPlaneError(409, "PC_REPLACED", "Lottery moved to another PC.");

// ── one person at one store ──────────────────────────────────────────────────

type Access = {
  user: Doc;
  /** Null when the person has no active assignment at the store (or it is closed). */
  reach: ReachableStore | null;
  store: Doc;
  license: Doc | null;
  pages: string[];
  blocked: Blocked | null;
};

/**
 * Everything the control plane knows about this person at this store, fresh from Mongo. Never
 * cached: a role change, a lapsed licence or a disabled person lands on the next call.
 */
async function accessAt(appUserId: string, storeId: string): Promise<Access | null> {
  const user = (await AppUserModel.findOne({ appUserId }).lean()) as Doc | null;
  if (!user) return null;
  const reach = (await reachableFor(appUserId)).find((row) => row.storeId === storeId);
  if (!reach) return { user, reach: null, store: {}, license: null, pages: [], blocked: null };
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Doc | null;
  if (!store) return null;
  await expireLapsedLicenses({ organizationId: text(store.organizationId) });
  const { license } = await coverageFor(store);
  const pages = lotteryPagesOf(reach.pages);
  return { user, reach, store, license, pages, blocked: whyBlocked(store, license) };
}

/**
 * Refuse unless the person is active, assigned here, the store can run lottery, and the role grants
 * a lottery page. The order is the order the person would fix them in.
 */
type Usable = Access & { reach: ReachableStore };

function requireUsable(access: Access | null): Usable {
  if (!access) throw noAccess();
  if (access.user.status !== "active") {
    throw new ControlPlaneError(403, "ACCOUNT_DISABLED", "This account has been turned off. Ask your manager.");
  }
  if (!access.reach) throw noAccess();
  if (access.blocked) throw refused(access.blocked);
  if (!access.pages.length) throw noAccess();
  return access as Usable;
}

/** A cloud token for this person on this PC, or none when the cloud is not set up. */
function mintFor(access: Access, pcId: string): { accessToken: string | null; expiresAt: string | null } {
  if (!isSupabaseConfigured()) return { accessToken: null, expiresAt: null };
  const { token, expiresAt } = mintSupabaseToken({
    app: "lottery",
    appUserId: text(access.user.appUserId),
    email: text(access.user.email),
    storeId: text(access.store.storeId),
    pcId,
    pages: access.pages
  });
  return { accessToken: token, expiresAt: expiresAt.toISOString() };
}

async function signedIn(access: Usable, pcId: string) {
  const refreshCredential = await issueRefreshFamily({
    appUserId: text(access.user.appUserId),
    storeId: text(access.store.storeId),
    pcId
  });
  return {
    next: "signed_in" as const,
    user: personView(access.user),
    store: storeView(access.store, access.license),
    role: { roleId: access.reach.role.roleId, roleName: access.reach.role.roleName },
    pages: access.pages,
    cloud: { refreshCredential, ...mintFor(access, pcId) },
    // Where the cloud is. Public by design: the publishable key reads nothing without a token.
    endpoint: publishableCloud(),
    offline: { maxAgeDays: OFFLINE_MAX_AGE_DAYS }
  };
}

async function activePcOfStore(storeId: string): Promise<Doc | null> {
  return (await LotteryPcModel.findOne({ storeId, status: "active" }).lean()) as Doc | null;
}

async function touchPc(pcId: string, storeId: string, fields: { pcName?: string; appVersion?: string }) {
  await LotteryPcModel.updateOne(
    { pcId, storeId, status: "active" },
    {
      $set: {
        lastSeenAt: new Date(),
        ...(fields.pcName ? { pcName: fields.pcName } : {}),
        ...(fields.appVersion ? { appVersion: fields.appVersion } : {})
      }
    }
  );
}

// ── request bodies ───────────────────────────────────────────────────────────

const PcId = z.string().trim().toLowerCase().uuid();
const PcName = z.string().trim().min(1).max(120);
const AppVersion = z.string().trim().max(40).optional();
const StoreId = z.string().trim().min(1).max(80);

export const SignInSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(200),
    pcId: PcId,
    pcName: PcName,
    appVersion: AppVersion,
    storeId: StoreId.optional()
  })
  .strict();

export const BindSchema = z
  .object({
    ticket: z.string().trim().min(1).max(200),
    storeId: StoreId,
    pcId: PcId,
    pcName: PcName,
    appVersion: AppVersion,
    takeOver: z.boolean().optional().default(false)
  })
  .strict();

export const TokenSchema = z
  .object({ refreshCredential: z.string().trim().min(1).max(200), pcId: PcId, appVersion: AppVersion })
  .strict();

export const RosterSchema = z.object({ emails: z.array(EmailSchema).max(200) }).strict();
export const SignOutSchema = z.object({ refreshCredential: z.string().trim().min(1).max(200) }).strict();
export const UnbindSchema = z
  .object({ pcId: PcId, refreshCredential: z.string().trim().min(1).max(200).optional() })
  .strict();

/** Every lottery route answers a schema failure 422, as the design's contract says. */
export async function lotteryBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new ControlPlaneError(422, "REQUEST_INVALID", `${where}${issue?.message ?? "Invalid request"}`);
  }
  return parsed.data;
}

// ── POST /api/v1/lottery/sign-in ─────────────────────────────────────────────

const ticketHash = (ticket: string) => createHash("sha256").update(ticket).digest("hex");

/** The picker: every store the person is assigned to, with the one reason it can't be picked. */
async function storesFor(appUserId: string, pcId: string) {
  const reachable = await reachableFor(appUserId);
  if (!reachable.length) return [];
  const storeIds = reachable.map((row) => row.storeId);
  const [stores, others] = (await Promise.all([
    TenantStoreModel.find({ storeId: { $in: storeIds } }).lean(),
    LotteryPcModel.find({ storeId: { $in: storeIds }, status: "active" }).lean()
  ])) as [Doc[], Doc[]];
  const byId = new Map(stores.map((store) => [text(store.storeId), store]));
  const organizations = [...new Set(stores.map((store) => text(store.organizationId)))];
  for (const organizationId of organizations) await expireLapsedLicenses({ organizationId });

  const rows = [];
  for (const reach of reachable) {
    const store = byId.get(reach.storeId);
    if (!store) continue;
    const { license } = await coverageFor(store);
    const pages = lotteryPagesOf(reach.pages);
    const blocked = whyBlocked(store, license) ?? (pages.length ? null : NO_LOTTERY_PAGES);
    const other = others.find((row) => text(row.storeId) === reach.storeId && text(row.pcId) !== pcId) ?? null;
    rows.push({
      storeId: reach.storeId,
      name: reach.name,
      storeNumber: reach.storeNumber,
      timeZone: reach.timeZone,
      role: { roleId: reach.role.roleId, roleName: reach.role.roleName },
      pages,
      blocked: blocked ? { code: blocked.code, message: blocked.message } : null,
      otherPc: other ? { pcName: text(other.pcName), lastSeenAt: iso(other.lastSeenAt) } : null,
      mayMove: pages.includes("lotterySettings")
    });
  }
  return rows;
}

export async function lotterySignIn(body: z.output<typeof SignInSchema>, ip: string) {
  await connectDb();
  // Password, lockout, per-IP and per-email counting and the failed-login audit, as for every app.
  const { user } = await signIn({ email: body.email, password: body.password, ip });
  const appUserId = user.appUserId;

  if (!body.storeId) {
    const stores = await storesFor(appUserId, body.pcId);
    const usable = stores.filter((row) => row.blocked === null);
    let ticket: string | null = null;
    if (usable.length) {
      ticket = `lst_${randomBytes(32).toString("base64url")}`;
      await LotterySignInTicketModel.create({
        hash: ticketHash(ticket),
        appUserId,
        pcId: body.pcId,
        storeIds: usable.map((row) => row.storeId),
        expiresAt: new Date(Date.now() + TICKET_MS)
      });
    }
    const person = (await AppUserModel.findOne({ appUserId }).lean()) as Doc;
    return {
      next: usable.length === 0 ? ("no_stores" as const) : usable.length === 1 ? ("one_store" as const) : ("pick_a_store" as const),
      user: personView(person),
      ticket,
      stores
    };
  }

  // A bound PC: the person must be able to use lottery at *this* store, now.
  const access = requireUsable(await accessAt(appUserId, body.storeId));
  const storeId = body.storeId;

  const mine = (await LotteryPcModel.findOne({ pcId: body.pcId, storeId, status: "active" }).lean()) as Doc | null;
  if (!mine) {
    const history = (await LotteryPcModel.find({ pcId: body.pcId }).sort({ createdAt: -1 }).lean()) as Doc[];
    const last = history.find((row) => text(row.storeId) === storeId);
    if (last?.status === "replaced") throw replaced();
    // A PC set up before D-26 has never had a LotteryPc row. It is bound on its first online
    // sign-in, if nothing else holds the store — never over another PC, which needs a takeover.
    if (history.length || (await activePcOfStore(storeId))) throw notBound();
    await bindPc({ access, pcId: body.pcId, pcName: body.pcName, appVersion: body.appVersion, via: "legacy" });
  } else {
    await touchPc(body.pcId, storeId, { pcName: body.pcName, appVersion: body.appVersion });
  }
  return signedIn(access, body.pcId);
}

// ── POST /api/v1/lottery/bind ────────────────────────────────────────────────

async function bindPc(input: {
  access: Usable;
  pcId: string;
  pcName: string;
  appVersion?: string;
  via: "picker" | "legacy";
  replacing?: Doc | null;
}) {
  const { access, pcId } = input;
  const storeId = text(access.store.storeId);
  const organizationId = text(access.store.organizationId);
  const appUserId = text(access.user.appUserId);
  const now = new Date();

  if (input.replacing) {
    const old = input.replacing;
    const moved = await LotteryPcModel.updateOne(
      { _id: old._id, status: "active" },
      { $set: { status: "replaced", replacedBy: pcId, endedAt: now, endedBy: appUserId } }
    );
    if (!moved.modifiedCount) throw alreadyActive(old);
    await revokeRefreshFamilies({ pcId: text(old.pcId), storeId }, "pc_replaced");
  }

  try {
    await LotteryPcModel.create({
      pcId,
      storeId,
      organizationId,
      pcName: input.pcName,
      status: "active",
      boundAt: now,
      boundBy: appUserId,
      boundByEmail: text(access.user.email),
      boundVia: input.via,
      lastSeenAt: now,
      ...(input.appVersion ? { appVersion: input.appVersion } : {})
    });
  } catch (error) {
    // The partial unique indexes: another PC won the store, or this PC won another store, a moment ago.
    if ((error as { code?: number }).code === 11000) {
      const other = await activePcOfStore(storeId);
      if (other && text(other.pcId) !== pcId) throw alreadyActive(other);
      throw new ControlPlaneError(409, "PC_BOUND_ELSEWHERE", "This PC runs lottery for another store. Switch store first.");
    }
    throw error;
  }

  await writeAudit({
    organizationId,
    storeId,
    actorType: "app_user",
    actorId: appUserId,
    action: input.replacing ? "lottery_pc.replaced" : "lottery_pc.bound",
    targetType: "lottery_pc",
    targetId: pcId,
    metadata: {
      pcName: input.pcName,
      via: input.via,
      by: appUserId,
      ...(input.replacing ? { old: text(input.replacing.pcId), oldPcName: text(input.replacing.pcName), new: pcId } : {})
    }
  });
  // The cloud learns which PC is live, and the replaced one's id goes on its revocation list.
  scheduleProjectionPush(storeId, input.replacing ? "lottery_pc.replaced" : "lottery_pc.bound");
}

function alreadyActive(other: Doc) {
  return new ControlPlaneError(409, "PC_ALREADY_ACTIVE", `Lottery runs on ${text(other.pcName)} for this store.`, false, {
    otherPc: { pcName: text(other.pcName), lastSeenAt: iso(other.lastSeenAt) }
  });
}

export async function lotteryBind(body: z.output<typeof BindSchema>) {
  await connectDb();
  const invalidTicket = () => new ControlPlaneError(401, "TICKET_INVALID", "Sign in again.");

  // 1. The ticket is used up by this call, pass or fail.
  const ticket = (await LotterySignInTicketModel.findOneAndUpdate(
    { hash: ticketHash(body.ticket), usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } }
  ).lean()) as Doc | null;
  if (!ticket) throw invalidTicket();
  if (new Date(String(ticket.expiresAt)).getTime() <= Date.now() || text(ticket.pcId) !== body.pcId) throw invalidTicket();
  if (!((ticket.storeIds as string[] | undefined) ?? []).includes(body.storeId)) throw noAccess();

  // 2. The person, fresh: still assigned, the store can still run lottery, the role still grants it.
  const access = requireUsable(await accessAt(text(ticket.appUserId), body.storeId));

  // 3. One store per PC. Switching goes through unbind.
  const elsewhere = (await LotteryPcModel.findOne({ pcId: body.pcId, status: "active" }).lean()) as Doc | null;
  if (elsewhere && text(elsewhere.storeId) !== body.storeId) {
    throw new ControlPlaneError(409, "PC_BOUND_ELSEWHERE", "This PC runs lottery for another store. Switch store first.");
  }

  // 4. One PC per store. Taking over needs lotterySettings, checked here and not on the screen.
  if (!elsewhere) {
    const other = await activePcOfStore(body.storeId);
    if (other) {
      if (!body.takeOver) throw alreadyActive(other);
      if (!access.pages.includes("lotterySettings")) {
        throw new ControlPlaneError(403, "MOVE_NOT_ALLOWED", "Only someone with lottery settings can move lottery to this PC.");
      }
    }
    await bindPc({ access, pcId: body.pcId, pcName: body.pcName, appVersion: body.appVersion, via: "picker", replacing: other });
  } else {
    // Already this store's PC (a retry after a lost answer): nothing to move.
    await touchPc(body.pcId, body.storeId, { pcName: body.pcName, appVersion: body.appVersion });
  }
  return signedIn(access, body.pcId);
}

// ── POST /api/v1/lottery/token ───────────────────────────────────────────────

export async function lotteryToken(body: z.output<typeof TokenSchema>) {
  await connectDb();
  // Before anything rotates: a cloud that is not there must not cost the PC its credential.
  if (!isSupabaseConfigured()) {
    throw new ControlPlaneError(503, "CLOUD_UNAVAILABLE", "The lottery cloud is not configured", true);
  }
  const checked = await checkRefreshCredential(body.refreshCredential, body.pcId);
  if (!checked.ok) throw checked.error;
  // Counted only once the caller has shown a real credential for this PC: a pcId alone, which a clerk
  // can read from their own token, must not be enough to use up the PC's refreshes.
  pcRateLimit("lottery-token-pc", body.pcId, 120, "TOKEN_RATE_LIMITED");
  const family = checked.family;
  const appUserId = text(family.appUserId);
  const storeId = text(family.storeId);
  const familyId = text(family.familyId);

  // The claims are rebuilt from Mongo every time.
  const access = await accessAt(appUserId, storeId);
  if (!access || access.user.status !== "active") {
    await revokeRefreshFamilies({ familyId }, "account_disabled");
    throw new ControlPlaneError(403, "ACCOUNT_DISABLED", "This account has been turned off. Ask your manager.");
  }
  const changed = access.user.passwordChangedAt ? new Date(String(access.user.passwordChangedAt)).getTime() : 0;
  if (changed > new Date(String(family.createdAt)).getTime()) {
    await revokeRefreshFamilies({ familyId }, "password_changed");
    throw new ControlPlaneError(401, "REFRESH_INVALID", "Sign in again.");
  }
  if (!access.reach || !access.pages.length) {
    await revokeRefreshFamilies({ familyId }, "no_lottery_access");
    throw noAccess();
  }

  const pc = (await LotteryPcModel.findOne({ pcId: body.pcId, storeId, status: "active" }).lean()) as Doc | null;
  if (!pc) {
    const last = (await LotteryPcModel.findOne({ pcId: body.pcId, storeId }).sort({ createdAt: -1 }).lean()) as Doc | null;
    await revokeRefreshFamilies({ familyId }, last?.status === "replaced" ? "pc_replaced" : "pc_unbound");
    throw last?.status === "replaced" ? replaced() : notBound();
  }

  // A licence that lapsed, or lottery switched off: the cloud pauses, the credential stays good.
  if (access.blocked) throw refused(access.blocked);

  const refreshCredential = await rotateRefreshCredential(family, checked.presentedHash);
  await touchPc(body.pcId, storeId, { appVersion: body.appVersion });
  const minted = mintFor(access, body.pcId);
  return {
    accessToken: minted.accessToken,
    expiresAt: minted.expiresAt,
    refreshCredential,
    user: { status: text(access.user.status), passwordChangedAt: iso(access.user.passwordChangedAt) },
    role: { roleId: access.reach.role.roleId, roleName: access.reach.role.roleName },
    pages: access.pages,
    store: { licence: licenceView(access.license) },
    endpoint: publishableCloud()
  };
}

// ── the PC's bearer routes: roster, unbind ───────────────────────────────────

/**
 * A lottery PC's own call, with the access token from `/token`: a person's token, for the lottery
 * app, naming a PC that is still that store's active lottery PC.
 */
export async function authorizeLotteryPc(req: Request): Promise<{ claims: SupabaseClaims; pc: Doc }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ControlPlaneError(401, "TOKEN_INVALID", "That token is not valid");
  const { claims } = readSupabaseToken(token);
  if (claims.app !== "lottery" || !claims.pc || !claims.store) {
    throw new ControlPlaneError(401, "TOKEN_INVALID", "That token is not valid");
  }
  await connectDb();
  const pc = (await LotteryPcModel.findOne({ pcId: claims.pc, storeId: claims.store, status: "active" }).lean()) as Doc | null;
  if (!pc) throw notBound();
  return { claims, pc };
}

/** Who of these emails may still use lottery here. Everyone else — unknown included — is `gone`. */
export async function lotteryRoster(claims: SupabaseClaims, emails: readonly string[]) {
  const storeId = claims.store;
  const unique = [...new Set(emails.map((email) => email.toLowerCase()))];
  const users = (await AppUserModel.find({ email: { $in: unique } }).lean()) as Doc[];
  const byEmail = new Map(users.map((user) => [text(user.email).toLowerCase(), user]));
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Doc | null;

  const people = [];
  for (const email of unique) {
    const user = byEmail.get(email);
    const reach = user && user.status === "active" && store ? (await reachableFor(text(user.appUserId))).find((row) => row.storeId === storeId) : undefined;
    const pages = reach ? lotteryPagesOf(reach.pages) : [];
    if (!user || !reach || !pages.length) {
      people.push({ email, status: "gone" as const, role: null, pages: [], passwordChangedAt: null });
      continue;
    }
    people.push({
      email,
      status: "active" as const,
      role: { roleId: reach.role.roleId, roleName: reach.role.roleName },
      pages,
      passwordChangedAt: iso(user.passwordChangedAt)
    });
  }
  return { people };
}

async function endPc(pc: Doc, by: { actorType: "app_user" | "internal_admin"; actorId: string }, action: string) {
  const storeId = text(pc.storeId);
  const ended = await LotteryPcModel.updateOne(
    { _id: pc._id, status: "active" },
    { $set: { status: "unbound", endedAt: new Date(), endedBy: by.actorId } }
  );
  if (!ended.modifiedCount) throw notBound();
  await revokeRefreshFamilies({ pcId: text(pc.pcId) }, "pc_unbound");
  await writeAudit({
    organizationId: text(pc.organizationId),
    storeId,
    actorType: by.actorType,
    actorId: by.actorId,
    action,
    targetType: "lottery_pc",
    targetId: text(pc.pcId),
    metadata: { pcName: text(pc.pcName) }
  });
  scheduleProjectionPush(storeId, action);
}

/** Switch store: the PC lets go of its store. Needs lotterySettings, re-checked against Mongo. */
export async function lotteryUnbind(claims: SupabaseClaims, pc: Doc, pcId: string) {
  if (pcId !== claims.pc) throw notBound();
  const access = await accessAt(claims.user, claims.store);
  if (!claims.pages.includes("lotterySettings") || !access?.pages.includes("lotterySettings") || access.user.status !== "active") {
    throw new ControlPlaneError(403, "PAGE_NOT_ALLOWED", "Only someone with lottery settings can switch store.");
  }
  await endPc(pc, { actorType: "app_user", actorId: claims.user }, "lottery_pc.unbound");
  return { ok: true as const };
}

/**
 * Switch store with the person's own refresh credential on this PC instead of an access token, so it
 * works on a control plane with no lottery cloud (and through a Supabase outage). The credential is
 * only checked, never rotated: every family on the PC is revoked a moment later anyway. The person's
 * lotterySettings is checked against Mongo, as for the token path.
 */
export async function lotteryUnbindWithCredential(body: { pcId: string; refreshCredential: string }) {
  await connectDb();
  const checked = await checkRefreshCredential(body.refreshCredential, body.pcId);
  if (!checked.ok) throw checked.error;
  pcRateLimit("lottery-unbind", body.pcId, 10, "RATE_LIMITED");
  const appUserId = text(checked.family.appUserId);
  const storeId = text(checked.family.storeId);
  const pc = (await LotteryPcModel.findOne({ pcId: body.pcId, storeId, status: "active" }).lean()) as Doc | null;
  if (!pc) throw notBound();
  const access = await accessAt(appUserId, storeId);
  if (!access?.pages.includes("lotterySettings") || access.user.status !== "active") {
    throw new ControlPlaneError(403, "PAGE_NOT_ALLOWED", "Only someone with lottery settings can switch store.");
  }
  await endPc(pc, { actorType: "app_user", actorId: appUserId }, "lottery_pc.unbound");
  return { ok: true as const };
}

export function pcRateLimit(key: string, pcId: string, limit: number, code: string) {
  enforceRateLimit(`${key}:${pcId}`, { limit, windowMs: 60 * 60_000, code });
}

// ── admin ────────────────────────────────────────────────────────────────────

/** What the admin card shows: the store's lottery PC, if any, and the cloud's view of it. */
export async function lotteryPcView(storeId: string) {
  await connectDb();
  await requireStore(storeId);
  const pc = (await LotteryPcModel.findOne({ storeId, status: "active" }).lean()) as Doc | null;
  return {
    pc: pc
      ? {
          pcName: text(pc.pcName),
          status: text(pc.status),
          boundAt: iso(pc.boundAt),
          boundBy: pc.boundByEmail ? text(pc.boundByEmail) : text(pc.boundBy),
          lastSeenAt: iso(pc.lastSeenAt),
          appVersion: pc.appVersion ? text(pc.appVersion) : null
        }
      : null,
    health: await readStoreHealth(storeId)
  };
}

/** An admin lets go of the store's lottery PC: the same effect as the PC's own unbind. */
export async function releaseLotteryPc(admin: InternalAdminActor, storeId: string) {
  await connectDb();
  await requireStore(storeId);
  const pc = await activePcOfStore(storeId);
  if (!pc) throw new ControlPlaneError(409, "PC_NOT_BOUND", "This store has no lottery PC.");
  // One audit line, with the admin as its actor.
  await endPc(pc, { actorType: "internal_admin", actorId: admin.adminId }, "lottery_pc.released");
  return { ok: true as const };
}
