import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, VALID_ACKS, VALID_INSTALLATION } from "./helpers/api";
import {
  AppUserModel,
  LotteryPcModel,
  LotteryRefreshCredentialModel,
  LotterySignInTicketModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { hashSecret, issueSetupKey, publicId } from "@/lib/control-plane-security";
import { updateStoreSettings, getStoreSettings, createStore } from "@/lib/tenant-stores";
import { setUserPassword, updateUser, revokeAssignment } from "@/lib/users";
import { readSupabaseToken, mintSupabaseToken } from "@/lib/supabase-token";
import { migrateLotterySignIn } from "@/lib/migrations";
import { POST as signIn } from "@/app/api/v1/lottery/sign-in/route";
import { POST as bind } from "@/app/api/v1/lottery/bind/route";
import { POST as token } from "@/app/api/v1/lottery/token/route";
import { POST as signOut } from "@/app/api/v1/lottery/sign-out/route";
import { POST as unbind } from "@/app/api/v1/lottery/unbind/route";
import { POST as roster } from "@/app/api/v1/lottery/pc/roster/route";
import { GET as adminLottery } from "@/app/api/v1/admin/stores/[storeId]/lottery/route";
import { POST as adminRelease } from "@/app/api/v1/admin/stores/[storeId]/lottery/pc/release/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";

// The service-role side needs Next's `server-only`; the cloud itself is not under test here.
vi.mock("@/lib/supabase-admin", () => ({
  scheduleProjectionPush: vi.fn(),
  isCloudConfigured: () => false,
  publishableCloud: () => ({ url: "https://example.supabase.co", anonKey: "publishable" }),
  readStoreHealth: vi.fn(async () => null)
}));
vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cloudflare")>()),
  provisionTunnel: vi.fn(async () => ({ tunnelUrl: null, tunnelToken: null, tunnelName: null }))
}));

setupMemoryMongo();

const SECRET = "a-test-jwt-secret-long-enough-to-pass-0123456789";
const PASSWORD = "counter-password-42";
const PC_A = "0b6c1d52-4a9e-4c55-9d7c-6f5a2d7e9b10";
const PC_B = "7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6";

let admin: Awaited<ReturnType<typeof createAdmin>>;
let organizationId: string;
let storeId: string;
let manager: string;

const page = (key: string) => ({ key, enabled: true, featureFlags: {} });
const ROLES = [
  {
    roleId: "manager",
    roleName: "Manager",
    version: 1,
    updatedAt: "2026-09-01T00:00:00.000Z",
    accessKeys: {
      electron: { pages: [page("pos")] },
      mobile: { pages: [] },
      lottery: { pages: ["lottery", "lotteryClose", "lotteryCorrect", "lotteryReports", "lotterySettings"].map(page) }
    }
  },
  {
    roleId: "clerk",
    roleName: "Clerk",
    version: 1,
    updatedAt: "2026-09-01T00:00:00.000Z",
    accessKeys: { electron: { pages: [] }, mobile: { pages: [] }, lottery: { pages: [page("lottery"), page("lotteryClose")] } }
  },
  {
    roleId: "stocker",
    roleName: "Stocker",
    version: 1,
    updatedAt: "2026-09-01T00:00:00.000Z",
    accessKeys: { electron: { pages: [page("pos")] }, mobile: { pages: [] }, lottery: { pages: [] } }
  }
];

async function sellLottery(target: string, lottery = true) {
  const current = await getStoreSettings(target);
  await updateStoreSettings(
    admin,
    target,
    { capabilities: { lottery, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null } },
    current.settingsVersion
  );
  await TenantStoreModel.updateOne({ storeId: target }, { $set: { roles: ROLES } });
}

async function person(email: string, role: string, at: string[] = [storeId], status = "active") {
  const appUserId = publicId("appu");
  await AppUserModel.create({
    appUserId,
    email,
    name: email.split("@")[0],
    status,
    passwordHash: await hashSecret(PASSWORD),
    passwordChangedAt: new Date(Date.now() - 86_400_000),
    createdInOrganizationId: organizationId,
    createdByAdminId: admin.adminId
  });
  for (const target of at) {
    await UserAssignmentModel.create({
      assignmentId: publicId("assign"),
      appUserId,
      organizationId,
      storeId: target,
      role,
      status: "active",
      createdByAdminId: admin.adminId
    });
  }
  return appUserId;
}

let ip = 0;
const from = () => ({ "x-forwarded-for": `203.0.113.${(ip = (ip + 1) % 250)}` });

const signInAs = (email: string, extra: Record<string, unknown> = {}, password = PASSWORD) =>
  call(signIn, request("POST", "/", { body: { email, password, pcId: PC_A, pcName: "FRONT-PC", appVersion: "0.2.0", ...extra }, headers: from() }));

const bindWith = (body: Record<string, unknown>) =>
  call(bind, request("POST", "/", { body: { pcId: PC_A, pcName: "FRONT-PC", appVersion: "0.2.0", ...body }, headers: from() }));

const refresh = (refreshCredential: string, pcId = PC_A) =>
  call(token, request("POST", "/", { body: { refreshCredential, pcId, appVersion: "0.2.1" }, headers: from() }));

/** First run on a PC: sign in, pick the store, bind. */
async function bindPc(email: string, pcId = PC_A, takeOver = false) {
  const first = await signInAs(email, { pcId });
  expect(first.status).toBe(200);
  return bindWith({ ticket: first.body.ticket, storeId, pcId, takeOver });
}

beforeEach(async () => {
  process.env.SUPABASE_JWT_SECRET = SECRET;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  admin = await createAdmin();
  const seeded = await seedOrganization(admin, { maxPcsPerStore: 1 });
  organizationId = seeded.organization.organizationId;
  storeId = seeded.store.storeId;
  await sellLottery(storeId);
  manager = await person("pat@shop.com", "manager");
  await person("sam@shop.com", "clerk");
});
afterEach(() => {
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.SUPABASE_URL;
});

describe("first run: email and password, then the store", () => {
  it("answers one store and a ticket, and nothing secret", async () => {
    const res = await signInAs("Pat@Shop.com");
    expect(res.status).toBe(200);
    expect(res.body.next).toBe("one_store");
    expect(res.body.ticket).toMatch(/^lst_/);
    expect(res.body.user).toMatchObject({ appUserId: manager, email: "pat@shop.com", status: "active" });
    expect(res.body.stores).toEqual([
      expect.objectContaining({ storeId, blocked: null, otherPc: null, mayMove: true, pages: expect.arrayContaining(["lotterySettings"]) })
    ]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain("$argon2");
    expect(text).not.toContain("refreshCredential");
    // Only the ticket's hash is kept.
    const stored = await LotterySignInTicketModel.findOne({}).lean();
    expect(JSON.stringify(stored)).not.toContain(res.body.ticket);
  });

  it("gives one answer for a wrong password and an unknown email", async () => {
    const wrong = await signInAs("pat@shop.com", {}, "not-the-password");
    const unknown = await signInAs("nobody@shop.com");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe("LOGIN_INVALID");
    expect(unknown.body.error).toMatchObject({ code: "LOGIN_INVALID", message: wrong.body.error.message });
  });

  it("refuses a disabled person", async () => {
    await person("gone@shop.com", "manager", [storeId], "disabled");
    const res = await signInAs("gone@shop.com");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("refuses a malformed request with 422", async () => {
    const res = await signInAs("pat@shop.com", { pcId: "not-a-uuid" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUEST_INVALID");
  });

  it("greys the stores that can't run lottery, with the reason, and lists only the person's stores", async () => {
    const { store: noLottery } = await createStore(admin, organizationId, { name: "Elm Rd", storeLicense: { plan: "standard" } });
    const { store: noRole } = await createStore(admin, organizationId, { name: "Oak Ave", storeLicense: { plan: "standard" } });
    const { store: notMine } = await createStore(admin, organizationId, { name: "Pine St", storeLicense: { plan: "standard" } });
    await sellLottery(noLottery.storeId, false);
    await sellLottery(noRole.storeId);
    await sellLottery(notMine.storeId);
    const appUserId = await person("kim@shop.com", "clerk", [storeId, noLottery.storeId]);
    await UserAssignmentModel.create({
      assignmentId: publicId("assign"),
      appUserId,
      organizationId,
      storeId: noRole.storeId,
      role: "stocker",
      status: "active",
      createdByAdminId: admin.adminId
    });

    const res = await signInAs("kim@shop.com");
    expect(res.body.next).toBe("one_store");
    const byName = Object.fromEntries(res.body.stores.map((row: { name: string }) => [row.name, row]));
    expect(Object.keys(byName).sort()).toEqual(["Elm Rd", "Oak Ave", "Store 42"]);
    expect(byName["Elm Rd"].blocked.code).toBe("STORE_NO_LOTTERY");
    expect(byName["Oak Ave"].blocked).toEqual({ code: "NO_LOTTERY_PAGES", message: "Your role can't use StoreDesk Lottery here." });
    expect(byName["Store 42"]).toMatchObject({ blocked: null, mayMove: false });
  });

  it("says no_stores and hands out no ticket when nothing is usable", async () => {
    await person("stocker@shop.com", "stocker");
    const res = await signInAs("stocker@shop.com");
    expect(res.body).toMatchObject({ next: "no_stores", ticket: null });
  });

  it("greys a store with no licence in force", async () => {
    await (await import("@/models/ControlPlane")).LicenseModel.updateMany({ storeId }, { status: "suspended" });
    const res = await signInAs("pat@shop.com");
    expect(res.body.next).toBe("no_stores");
    expect(res.body.stores[0].blocked.code).toBe("LICENSE_INACTIVE");
    expect(res.body.stores[0].blocked.message).not.toMatch(/SD-(ORG|STR)-/);
  });
});

describe("bind: the ticket makes this PC the store's lottery PC", () => {
  it("binds, answers a session with a person token for this store and PC, and audits it", async () => {
    const res = await bindPc("pat@shop.com");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      next: "signed_in",
      store: { storeId, name: "Store 42", licence: { covered: true } },
      role: { roleId: "manager" },
      offline: { maxAgeDays: 30 }
    });
    // The lottery PC reads where the cloud is from `endpoint` (lottery-sign-in.md §3).
    expect(res.body.endpoint).toEqual({ url: "https://example.supabase.co", anonKey: "publishable" });
    expect(res.body.cloud.refreshCredential).toMatch(/^lrt_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    const { claims } = readSupabaseToken(res.body.cloud.accessToken);
    expect(claims).toMatchObject({ kind: "user", app: "lottery", user: manager, store: storeId, stores: [storeId], pc: PC_A });

    expect(await LotteryPcModel.findOne({ pcId: PC_A, status: "active" }).lean()).toMatchObject({ storeId, boundBy: manager });
    expect(await lastAudit("lottery_pc.bound")).toMatchObject({ storeId, targetId: PC_A });

    // The credential is stored as a hash only.
    const stored = await LotteryRefreshCredentialModel.findOne({}).select("+hash +previousHashes").lean();
    const secret = String(res.body.cloud.refreshCredential).split(".")[1]!;
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it("spends the ticket, pass or fail", async () => {
    const first = await signInAs("pat@shop.com");
    expect((await bindWith({ ticket: first.body.ticket, storeId })).status).toBe(200);
    const again = await bindWith({ ticket: first.body.ticket, storeId });
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe("TICKET_INVALID");
  });

  it("refuses a ticket from another PC, an old ticket, and a store the ticket does not name", async () => {
    const first = await signInAs("pat@shop.com");
    expect((await bindWith({ ticket: first.body.ticket, storeId, pcId: PC_B })).body.error.code).toBe("TICKET_INVALID");

    const second = await signInAs("pat@shop.com");
    await LotterySignInTicketModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await bindWith({ ticket: second.body.ticket, storeId })).body.error.code).toBe("TICKET_INVALID");

    const { store: other } = await createStore(admin, organizationId, { name: "Other", storeLicense: { plan: "standard" } });
    const third = await signInAs("pat@shop.com");
    const res = await bindWith({ ticket: third.body.ticket, storeId: other.storeId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_LOTTERY_ACCESS");
  });

  it("refuses a second PC unless someone with lottery settings moves lottery there", async () => {
    const first = await bindPc("pat@shop.com");

    const plain = await bindPc("pat@shop.com", PC_B);
    expect(plain.status).toBe(409);
    expect(plain.body).toMatchObject({ error: { code: "PC_ALREADY_ACTIVE" }, otherPc: { pcName: "FRONT-PC" } });

    const byClerk = await bindPc("sam@shop.com", PC_B, true);
    expect(byClerk.status).toBe(403);
    expect(byClerk.body.error.code).toBe("MOVE_NOT_ALLOWED");

    const moved = await bindPc("pat@shop.com", PC_B, true);
    expect(moved.status).toBe(200);
    expect(await LotteryPcModel.findOne({ pcId: PC_A }).lean()).toMatchObject({ status: "replaced", replacedBy: PC_B });
    expect(await lastAudit("lottery_pc.replaced")).toMatchObject({ metadata: { old: PC_A, new: PC_B, by: manager } });

    // The old PC hears it has been replaced, so it shows "Lottery moved".
    const old = await refresh(first.body.cloud.refreshCredential);
    expect(old.status).toBe(409);
    expect(old.body.error.code).toBe("PC_REPLACED");
    const oldSignIn = await signInAs("pat@shop.com", { storeId });
    expect(oldSignIn.body.error.code).toBe("PC_REPLACED");
  });

  it("refuses a PC that already runs lottery for another store", async () => {
    await bindPc("pat@shop.com");
    const { store: other } = await createStore(admin, organizationId, { name: "Oak Ave", storeLicense: { plan: "standard" } });
    await sellLottery(other.storeId);
    await UserAssignmentModel.create({
      assignmentId: publicId("assign"),
      appUserId: manager,
      organizationId,
      storeId: other.storeId,
      role: "manager",
      status: "active",
      createdByAdminId: admin.adminId
    });
    const first = await signInAs("pat@shop.com");
    const res = await bindWith({ ticket: first.body.ticket, storeId: other.storeId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PC_BOUND_ELSEWHERE");
  });
});

describe("everyday sign-in on a bound PC", () => {
  beforeEach(async () => {
    await bindPc("pat@shop.com");
  });

  it("signs a second person in with their own role and pages", async () => {
    const res = await signInAs("sam@shop.com", { storeId });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ next: "signed_in", role: { roleId: "clerk" }, pages: ["lottery", "lotteryClose"] });
    expect(readSupabaseToken(res.body.cloud.accessToken).claims.pages).toEqual(["lottery", "lotteryClose"]);
  });

  it("refuses someone with no assignment at this store", async () => {
    const { store: other } = await createStore(admin, organizationId, { name: "Oak Ave", storeLicense: { plan: "standard" } });
    await sellLottery(other.storeId);
    await person("lee@shop.com", "manager", [other.storeId]);
    const res = await signInAs("lee@shop.com", { storeId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_LOTTERY_ACCESS");
  });

  it("refuses a PC that is not this store's lottery PC", async () => {
    const res = await signInAs("pat@shop.com", { storeId, pcId: PC_B });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PC_NOT_BOUND");
  });

  it("answers the cloud's absence without a token, and still signs in", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const res = await signInAs("pat@shop.com", { storeId });
    expect(res.status).toBe(200);
    expect(res.body.cloud).toMatchObject({ accessToken: null, expiresAt: null, refreshCredential: expect.stringMatching(/^lrt_/) });
  });
});

describe("a PC set up before D-26", () => {
  it("is bound on its first online sign-in when nothing else holds the store", async () => {
    const res = await signInAs("sam@shop.com", { storeId });
    expect(res.status).toBe(200);
    expect(await LotteryPcModel.findOne({ pcId: PC_A, status: "active" }).lean()).toMatchObject({ storeId, boundVia: "legacy" });
  });

  it("never takes the store over from another PC that way", async () => {
    await bindPc("pat@shop.com", PC_B);
    const res = await signInAs("sam@shop.com", { storeId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PC_NOT_BOUND");
  });
});

describe("the refresh credential rotates, and a copy is caught", () => {
  let first: string;
  beforeEach(async () => {
    first = (await bindPc("pat@shop.com")).body.cloud.refreshCredential;
  });

  it("answers a fresh token and a new credential, and the old one stops working", async () => {
    const res = await refresh(first);
    expect(res.status).toBe(200);
    expect(res.body.refreshCredential).not.toBe(first);
    expect(readSupabaseToken(res.body.accessToken).claims).toMatchObject({ store: storeId, pc: PC_A, user: manager });
    expect(res.body.endpoint).toEqual({ url: "https://example.supabase.co", anonKey: "publishable" });
    expect(res.body).toMatchObject({ user: { status: "active" }, role: { roleId: "manager" }, store: { licence: { covered: true } } });
    expect(await LotteryPcModel.findOne({ pcId: PC_A }).lean()).toMatchObject({ appVersion: "0.2.1" });

    const next = await refresh(res.body.refreshCredential);
    expect(next.status).toBe(200);
  });

  it("revokes the whole family when an old generation comes back", async () => {
    const rotated = (await refresh(first)).body.refreshCredential;
    const reused = await refresh(first);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("REFRESH_REUSED");
    // The copy killed the real one too.
    expect((await refresh(rotated)).body.error.code).toBe("REFRESH_REUSED");
    expect(await lastAudit("lottery.refresh_reused")).toBeTruthy();
  });

  it("learns nothing from a guess, and a credential only works on its own PC", async () => {
    const [prefix] = first.split(".");
    const guess = await refresh(`${prefix}.${"A".repeat(43)}`);
    expect(guess.body.error.code).toBe("REFRESH_INVALID");
    expect((await refresh("lrt_nonsense")).body.error.code).toBe("REFRESH_INVALID");
    expect((await refresh(first, PC_B)).body.error.code).toBe("REFRESH_INVALID");
    // The guess did not revoke the family.
    expect((await refresh(first)).status).toBe(200);
  });

  it("expires after sixty idle days", async () => {
    await LotteryRefreshCredentialModel.updateMany({}, { idleExpiresAt: new Date(Date.now() - 1000) });
    const res = await refresh(first);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REFRESH_EXPIRED");
  });

  it("dies when the person is turned off", async () => {
    await updateUser(admin, organizationId, manager, { status: "disabled" });
    const res = await refresh(first);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("dies when an admin sets a new password", async () => {
    await setUserPassword(admin, organizationId, manager, "a-brand-new-password");
    const res = await refresh(first);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REFRESH_INVALID");
  });

  it("dies when the person loses the store", async () => {
    const assignment = await UserAssignmentModel.findOne({ appUserId: manager }).lean();
    await revokeAssignment(admin, organizationId, manager, String(assignment!.assignmentId));
    const res = await refresh(first);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_LOTTERY_ACCESS");
  });

  it("dies when the role loses every lottery page", async () => {
    await UserAssignmentModel.updateOne({ appUserId: manager }, { role: "stocker" });
    const res = await refresh(first);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NO_LOTTERY_ACCESS");
    expect((await refresh(first)).status).toBe(403);
  });

  it("pauses the cloud when the licence lapses, and keeps the credential", async () => {
    const { LicenseModel } = await import("@/models/ControlPlane");
    await LicenseModel.updateMany({ storeId }, { status: "suspended" });
    const paused = await refresh(first);
    expect(paused.status).toBe(402);
    await LicenseModel.updateMany({ storeId }, { status: "active" });
    expect((await refresh(first)).status).toBe(200);
  });

  it("does not spend the credential when the cloud is not configured", async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const res = await refresh(first);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("CLOUD_UNAVAILABLE");
    process.env.SUPABASE_JWT_SECRET = SECRET;
    expect((await refresh(first)).status).toBe(200);
  });

  it("sign-out revokes the family and always answers ok", async () => {
    const out = await call(signOut, request("POST", "/", { body: { refreshCredential: first }, headers: from() }));
    expect(out.body).toEqual({ ok: true });
    expect((await refresh(first)).body.error.code).toBe("REFRESH_INVALID");
    const junk = await call(signOut, request("POST", "/", { body: { refreshCredential: "lrt_whatever" }, headers: from() }));
    expect(junk.status).toBe(200);
    expect(junk.body).toEqual({ ok: true });
  });
});

describe("the per-PC token limit counts only real credentials", () => {
  it("cannot be used up with junk credentials by someone who knows the pcId", async () => {
    const real = (await bindPc("pat@shop.com")).body.cloud.refreshCredential;
    for (let n = 0; n < 125; n += 1) {
      const junk = await refresh(`lrt_4f7c1a9e-2b3d-4c5e-8f70-8192a3b4c5d6.${"x".repeat(43)}`);
      expect(junk.body.error.code).toBe("REFRESH_INVALID");
    }
    expect((await refresh(real)).status).toBe(200);
  });
});

describe("unbind with the person's own refresh credential", () => {
  const unbindWith = (body: Record<string, unknown>) => call(unbind, request("POST", "/", { body, headers: from() }));

  it("switches store without the lottery cloud, and still checks lotterySettings", async () => {
    const managerCredential = (await bindPc("pat@shop.com")).body.cloud.refreshCredential;
    const clerkCredential = (await signInAs("sam@shop.com", { storeId })).body.cloud.refreshCredential;
    delete process.env.SUPABASE_JWT_SECRET;

    const byClerk = await unbindWith({ pcId: PC_A, refreshCredential: clerkCredential });
    expect(byClerk.status).toBe(403);
    expect(byClerk.body.error.code).toBe("PAGE_NOT_ALLOWED");
    expect((await unbindWith({ pcId: PC_B, refreshCredential: managerCredential })).body.error.code).toBe("REFRESH_INVALID");
    expect((await unbindWith({ pcId: PC_A })).status).toBe(401);

    const res = await unbindWith({ pcId: PC_A, refreshCredential: managerCredential });
    expect(res.body).toEqual({ ok: true });
    expect(await LotteryPcModel.findOne({ pcId: PC_A }).lean()).toMatchObject({ status: "unbound" });
    expect(await LotteryRefreshCredentialModel.countDocuments({ pcId: PC_A, status: "active" })).toBe(0);
    expect(await lastAudit("lottery_pc.unbound")).toMatchObject({ actorId: manager, targetId: PC_A });
    // Once released, the credential says so rather than "invalid": the PC goes back to picking a store.
    expect((await unbindWith({ pcId: PC_A, refreshCredential: managerCredential })).body.error.code).toBe("PC_NOT_BOUND");
  });
});

describe("the PC's bearer routes", () => {
  let managerToken: string;
  let clerkToken: string;
  beforeEach(async () => {
    managerToken = (await bindPc("pat@shop.com")).body.cloud.accessToken;
    clerkToken = (await signInAs("sam@shop.com", { storeId })).body.cloud.accessToken;
  });

  const rosterWith = (bearer: string, emails: string[]) => call(roster, request("POST", "/", { token: bearer, body: { emails } }));

  it("roster: active for people who may still use lottery here, gone for everyone else", async () => {
    await person("off@shop.com", "clerk", [storeId], "disabled");
    await person("stocker@shop.com", "stocker");
    const res = await rosterWith(clerkToken, ["pat@shop.com", "sam@shop.com", "off@shop.com", "stocker@shop.com", "nobody@shop.com"]);
    expect(res.status).toBe(200);
    const status = Object.fromEntries(res.body.people.map((row: { email: string; status: string }) => [row.email, row.status]));
    expect(status).toEqual({
      "pat@shop.com": "active",
      "sam@shop.com": "active",
      "off@shop.com": "gone",
      "stocker@shop.com": "gone",
      "nobody@shop.com": "gone"
    });
    expect(res.body.people[0]).toMatchObject({ role: { roleId: "manager" }, passwordChangedAt: expect.any(String) });
  });

  it("roster: refuses no token, a phone token and a token for a PC that is not the store's", async () => {
    expect((await call(roster, request("POST", "/", { body: { emails: [] } }))).status).toBe(401);
    const phone = mintSupabaseToken({ app: "mobile", appUserId: manager, email: "pat@shop.com", storeId, pages: ["mobileLotteryRack"] }).token;
    expect((await rosterWith(phone, [])).status).toBe(401);
    const stray = mintSupabaseToken({ app: "lottery", appUserId: manager, email: "pat@shop.com", storeId, pcId: PC_B, pages: ["lottery"] }).token;
    const res = await rosterWith(stray, []);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PC_NOT_BOUND");
  });

  it("unbind: needs lotterySettings and this PC, then lets the store go", async () => {
    const byClerk = await call(unbind, request("POST", "/", { token: clerkToken, body: { pcId: PC_A } }));
    expect(byClerk.status).toBe(403);
    expect(byClerk.body.error.code).toBe("PAGE_NOT_ALLOWED");

    const wrongPc = await call(unbind, request("POST", "/", { token: managerToken, body: { pcId: PC_B } }));
    expect(wrongPc.body.error.code).toBe("PC_NOT_BOUND");

    const res = await call(unbind, request("POST", "/", { token: managerToken, body: { pcId: PC_A } }));
    expect(res.body).toEqual({ ok: true });
    expect(await LotteryPcModel.findOne({ pcId: PC_A }).lean()).toMatchObject({ status: "unbound" });
    expect(await LotteryRefreshCredentialModel.countDocuments({ pcId: PC_A, status: "active" })).toBe(0);
    expect(await lastAudit("lottery_pc.unbound")).toMatchObject({ targetId: PC_A });
  });

  it("unbind: re-checks the role now, not only the token", async () => {
    await UserAssignmentModel.updateOne({ appUserId: manager }, { role: "clerk" });
    const res = await call(unbind, request("POST", "/", { token: managerToken, body: { pcId: PC_A } }));
    expect(res.status).toBe(403);
  });
});

describe("the admin card", () => {
  it("shows the bound PC and releases it", async () => {
    await bindPc("pat@shop.com");
    const view = await call(adminLottery, request("GET", "/", { token: admin.token }), { storeId });
    expect(view.status).toBe(200);
    expect(view.body.pc).toMatchObject({ pcName: "FRONT-PC", status: "active", boundBy: "pat@shop.com", appVersion: "0.2.0" });

    const released = await call(adminRelease, request("POST", "/", { token: admin.token }), { storeId });
    expect(released.body).toEqual({ ok: true });
    expect((await call(adminLottery, request("GET", "/", { token: admin.token }), { storeId })).body.pc).toBeNull();
    expect(await lastAudit("lottery_pc.released")).toMatchObject({ actorType: "internal_admin", targetId: PC_A });

    const again = await call(adminRelease, request("POST", "/", { token: admin.token }), { storeId });
    expect(again.status).toBe(409);
  });

  it("is admin only", async () => {
    expect((await call(adminLottery, request("GET", "/"), { storeId })).status).toBe(401);
    expect((await call(adminRelease, request("POST", "/"), { storeId })).status).toBe(401);
  });
});

// ── F-03 and the migration ──────────────────────────────────────────────────

async function lotteryInstallationWithKey() {
  const workerInstallationId = publicId("winst");
  await WorkerInstallationModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    product: "lottery",
    workerName: "StoreDesk Lottery",
    contactEmail: "store42@example.invalid",
    status: "awaiting_activation"
  });
  const key = issueSetupKey();
  await SetupKeyModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    keyId: key.keyId,
    secretHash: await hashSecret(key.secret),
    contactEmail: "store42@example.invalid",
    status: "shown",
    reusable: true,
    deliveryReason: "lottery_setup",
    idempotencyKey: publicId("idem")
  });
  return { workerInstallationId, key };
}

describe("a lottery setup key can never activate a StoreDesk PC (F-03)", () => {
  it("is refused WRONG_PRODUCT before anything is spent", async () => {
    const { workerInstallationId, key } = await lotteryInstallationWithKey();
    const res = await call(
      redeem,
      request("POST", "/", { body: { setupKey: key.plaintext, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION }, headers: from() })
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("WRONG_PRODUCT");
    expect(JSON.stringify(res.body)).not.toMatch(/cloudflareToken|relayKey|workerCredential/);
    expect(await SetupKeyModel.findOne({ keyId: key.keyId }).lean()).toMatchObject({ status: "shown", redeemCount: 0 });
    expect(await WorkerCredentialModel.countDocuments({ workerInstallationId })).toBe(0);
    expect(await WorkerInstallationModel.findOne({ workerInstallationId }).lean()).toMatchObject({ status: "awaiting_activation" });
  });
});

describe("2026-09-29-lottery-sign-in", () => {
  it("revokes every lottery key, credential and installation, once, and leaves StoreDesk alone", async () => {
    const { workerInstallationId, key } = await lotteryInstallationWithKey();
    const storedesk = await activatePc(organizationId, storeId);
    const lotteryPc = await activatePc(organizationId, storeId);
    await WorkerInstallationModel.updateOne({ workerInstallationId: lotteryPc.workerInstallationId }, { product: "lottery" });
    const before = (await TenantStoreModel.findOne({ storeId }).lean()) as { projectionVersion: number };

    const report = await migrateLotterySignIn();
    expect(report).toEqual({ keys: 1, credentials: 1, installations: 2, activeBefore: 1 });
    expect(await SetupKeyModel.findOne({ keyId: key.keyId }).lean()).toMatchObject({ status: "revoked", revokedReason: "d26_lottery_sign_in" });
    expect(await WorkerCredentialModel.findOne({ credentialId: lotteryPc.credentialId }).lean()).toMatchObject({ status: "revoked" });
    expect(await WorkerInstallationModel.countDocuments({ product: "lottery", status: { $ne: "revoked" } })).toBe(0);
    expect(await WorkerInstallationModel.findOne({ workerInstallationId }).lean()).toMatchObject({ status: "revoked" });
    expect(await lastAudit("lottery.d26_migrated")).toMatchObject({ metadata: report });
    const after = (await TenantStoreModel.findOne({ storeId }).lean()) as { projectionVersion: number };
    expect(after.projectionVersion).toBe(before.projectionVersion + 1);

    // StoreDesk's own PC and credential are untouched.
    expect(await WorkerCredentialModel.findOne({ credentialId: storedesk.credentialId }).lean()).toMatchObject({ status: "active" });
    expect(await WorkerInstallationModel.findOne({ workerInstallationId: storedesk.workerInstallationId }).lean()).toMatchObject({ status: "active" });

    // Idempotent.
    expect(await migrateLotterySignIn()).toEqual({ keys: 0, credentials: 0, installations: 0, activeBefore: 0 });
  });
});
