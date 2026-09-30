import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  TenantStoreModel,
  LotteryPcModel,
  UserAssignmentModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";
import { lotteryWords, MOBILE_TO_LOTTERY, mintSupabaseToken, readSupabaseToken, USER_TTL_SECONDS } from "@/lib/supabase-token";
import { buildStoreProjection, forbiddenInProjection, projectionFields } from "@/lib/supabase-projection";

setupMemoryMongo();

const SECRET = "a-test-jwt-secret-long-enough-to-pass-0123456789";

beforeEach(() => {
  process.env.SUPABASE_JWT_SECRET = SECRET;
  process.env.SUPABASE_URL = "https://example.supabase.co";
});
afterEach(() => {
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.SUPABASE_URL;
});

const person = (over: Partial<Parameters<typeof mintSupabaseToken>[0]> = {}) => ({
  app: "lottery" as const,
  appUserId: "user-1",
  email: "Dana@Example.com",
  storeId: "store-1",
  pcId: "0b6c1d52-4a9e-4c55-9d7c-6f5a2d7e9b10",
  pages: ["lottery", "lotteryClose"],
  ...over
});

describe("the token the control plane mints", () => {
  it("can only ever be an ordinary authenticated token", () => {
    const { token } = mintSupabaseToken(person());
    const body = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(body.role).toBe("authenticated");
    expect(JSON.stringify(body)).not.toContain("service_role");
  });

  it("is always a person's, for exactly one store, with the PC it was minted for", () => {
    const { claims } = readSupabaseToken(mintSupabaseToken(person()).token);
    expect(claims).toEqual({
      kind: "user",
      app: "lottery",
      user: "user-1",
      email: "dana@example.com",
      store: "store-1",
      stores: ["store-1"],
      pc: "0b6c1d52-4a9e-4c55-9d7c-6f5a2d7e9b10",
      pages: ["lottery", "lotteryClose"]
    });
  });

  it("cannot be minted for a device any more (D-26)", () => {
    // The input has no kind: a caller cannot ask for anything but a person.
    const { token } = mintSupabaseToken({ ...person(), kind: "device" } as never);
    const body = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(body.sd.kind).toBe("user");
    expect(body.sub).toBe("user-1");
  });

  it("drops anything that is not a lottery page, so the database checks one vocabulary", () => {
    const { claims } = readSupabaseToken(mintSupabaseToken(person({ pages: ["lotterySettings", "pos", "lottery", "lottery"] })).token);
    expect(claims.pages).toEqual(["lottery", "lotterySettings"]);
  });

  it("maps a phone's mobile keys to lottery words, never to correct or settings, and carries no PC", () => {
    const { claims } = readSupabaseToken(
      mintSupabaseToken(
        person({
          app: "mobile",
          pages: [
            "mobileLotteryRack",
            "mobileLotteryInventory",
            "mobileLotteryClose",
            "mobileLotteryReports",
            "mobileLotteryAnalytics",
            "lotterySettings",
            "lotteryCorrect"
          ]
        })
      ).token
    );
    expect(claims.app).toBe("mobile");
    expect(claims.pages).toEqual(["lottery", "lotteryClose", "lotteryReports"]);
    expect(claims.pc).toBeUndefined();
  });

  it("gives a person a quarter of an hour", () => {
    const { expiresAt } = mintSupabaseToken(person());
    const seconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
    expect(seconds).toBeGreaterThan(USER_TTL_SECONDS - 5);
    expect(seconds).toBeLessThanOrEqual(USER_TTL_SECONDS);
  });

  it("refuses a token somebody edited", () => {
    const { token } = mintSupabaseToken(person());
    const [header, payload, signature] = token.split(".");
    const tampered = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    tampered.sd.store = "another-store";
    const forged = `${header}.${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${signature}`;
    expect(() => readSupabaseToken(forged)).toThrow(/not valid/);
  });

  it("refuses a token that has run out", () => {
    const { token } = mintSupabaseToken(person(), -10);
    expect(() => readSupabaseToken(token)).toThrow(/expired/);
  });

  it("will not mint anything at all when the cloud is not set up", () => {
    delete process.env.SUPABASE_JWT_SECRET;
    expect(() => mintSupabaseToken(person())).toThrow(/not configured/);
  });

  it("maps pages the same way everywhere", () => {
    expect(lotteryWords("mobile", Object.keys(MOBILE_TO_LOTTERY))).toEqual(["lottery", "lotteryClose", "lotteryReports"]);
  });
});

// ── the projection ───────────────────────────────────────────────────────────

const PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$abcdefgh$ijklmnop";

const PC = "5f0e8a4c-1b2d-4e3f-9a8b-7c6d5e4f3a2b";

async function fixture(options: { lotteryPages?: boolean; userStatus?: string; mobileOnly?: boolean } = {}) {
  const organizationId = publicId("org");
  const storeId = publicId("str");
  const appUserId = publicId("appu");

  await OrganizationModel.create({
    organizationId,
    name: "Patel Retail",
    slug: "patel-retail",
    status: "active"
  });

  await TenantStoreModel.create({
    storeId,
    organizationId,
    roles: [
      {
        roleId: "clerk",
        roleName: "Clerk",
        accessKeys: {
          lottery: {
            pages: options.lotteryPages === false || options.mobileOnly ? [] : [{ key: "lottery", enabled: true, featureFlags: {} }]
          },
          electron: { pages: [{ key: "pos", enabled: true, featureFlags: {} }] },
          mobile: {
            pages: options.mobileOnly
              ? [
                  { key: "mobileLotteryClose", enabled: true, featureFlags: {} },
                  { key: "mobileLotteryRack", enabled: true, featureFlags: {} }
                ]
              : []
          }
        }
      }
    ],
    name: "Store 42",
    storeNumber: "42",
    status: "active",
    // Everything a store carries that must never reach the lottery cloud.
    cloudflareToken: "tunnel-token-that-must-not-travel",
    tunnelUrl: "https://store42.storedesk.net",
    posPasswordCipher: "register-password-cipher",
    settings: { capabilities: { lottery: true }, lottery: { appEnabled: true }, timeZone: "America/New_York" }
  });

  await LicenseModel.create({
    licenseId: publicId("lic"),
    organizationId,
    licenseNumber: "SD-STR-7K3Q92",
    scope: "store",
    storeId,
    plan: "standard",
    status: "active",
    startsAt: new Date(),
    entitlementExpiresAt: new Date(Date.now() + 86_400_000 * 30),
    offlineGraceDays: 7,
    coverageKey: `store:${storeId}`
  });

  await AppUserModel.create({
    appUserId,
    email: "Dana@Example.com",
    name: "Dana Patel",
    status: options.userStatus ?? "active",
    passwordHash: PASSWORD_HASH,
    createdByAdminId: publicId("adm")
  });

  await UserAssignmentModel.create({
    assignmentId: publicId("asg"),
    appUserId,
    organizationId,
    storeId,
    role: "clerk",
    status: "active",
    createdByAdminId: publicId("adm")
  });

  await LotteryPcModel.create({
    pcId: PC,
    storeId,
    organizationId,
    pcName: "FRONT-PC",
    status: "active",
    boundAt: new Date(),
    boundBy: appUserId
  });

  return { organizationId, storeId, appUserId };
}

describe("what the control plane tells the lottery cloud", () => {
  it("carries the store, its licence, its people and what they may do", async () => {
    const { storeId, appUserId } = await fixture();
    const projection = (await buildStoreProjection(storeId))!;

    expect(projection.store).toMatchObject({ id: storeId, name: "Store 42", time_zone: "America/New_York", cloud_mode: "cloud" });
    expect(projection.licence).toMatchObject({ status: "active", number: "SD-STR-7K3Q92", scope: "store", offline_grace_days: 7 });
    expect(projection.users).toEqual([{ id: appUserId, email: "dana@example.com", name: "Dana Patel", status: "active" }]);
    expect(projection.access).toEqual([{ user_id: appUserId, role: "clerk", pages: ["lottery"] }]);
    expect(projection.pcs).toEqual([{ id: PC, store_id: storeId, name: "FRONT-PC", status: "active" }]);
    expect(projection).not.toHaveProperty("device");
  });

  it("never carries a tunnel token, a relay key or a register password", async () => {
    const { storeId } = await fixture();
    const projection = await buildStoreProjection(storeId);
    const text = JSON.stringify(projection);

    for (const forbidden of forbiddenInProjection) expect(text).not.toContain(forbidden);
    expect(text).not.toContain("tunnel-token-that-must-not-travel");
    expect(text).not.toContain("register-password-cipher");
    expect(text).not.toContain("storedesk.net");
  });

  it("carries only the fields it is allowed to, so a new field on a store cannot slip through", async () => {
    const { storeId } = await fixture();
    const projection = (await buildStoreProjection(storeId))!;

    expect(Object.keys(projection.store).sort()).toEqual([...projectionFields.store].sort());
    expect(Object.keys(projection.organization).sort()).toEqual([...projectionFields.organization].sort());
    expect(Object.keys(projection.licence).sort()).toEqual([...projectionFields.licence].sort());
    expect(Object.keys(projection.users[0]!).sort()).toEqual([...projectionFields.users].sort());
    expect(Object.keys(projection.access[0]!).sort()).toEqual([...projectionFields.access].sort());
    expect(Object.keys(projection.pcs[0]!).sort()).toEqual([...projectionFields.pcs].sort());
  });

  it("never carries a password hash (D-26): a lottery PC keeps its own verifier", async () => {
    const { storeId } = await fixture();
    const text = JSON.stringify(await buildStoreProjection(storeId));
    expect(text).not.toContain(PASSWORD_HASH);
    expect(text).not.toContain("argon2");
    expect(text).not.toContain("password");
  });

  it("gives a phone-only lottery role its pages in lottery words", async () => {
    const { storeId, appUserId } = await fixture({ mobileOnly: true });
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.access).toEqual([{ user_id: appUserId, role: "clerk", pages: ["lottery", "lotteryClose"] }]);
  });

  it("revokes a replaced PC at once, but not one that is live again somewhere", async () => {
    const { storeId, organizationId, appUserId } = await fixture();
    const other = "11111111-2222-4333-8444-555555555555";
    await LotteryPcModel.updateOne({ pcId: PC }, { status: "replaced", replacedBy: other });
    await LotteryPcModel.create({ pcId: other, storeId, organizationId, pcName: "BACK-PC", status: "active", boundAt: new Date(), boundBy: appUserId });
    let projection = (await buildStoreProjection(storeId))!;
    expect(projection.revoked).toContain(PC);
    expect(projection.revoked).not.toContain(other);
    expect(projection.pcs.map((pc) => pc.status).sort()).toEqual(["active", "replaced"]);

    // The same PC bound again at another store: its id must not stay on a revocation list.
    await LotteryPcModel.create({
      pcId: PC,
      storeId: publicId("str"),
      organizationId,
      pcName: "FRONT-PC",
      status: "active",
      boundAt: new Date(),
      boundBy: appUserId
    });
    projection = (await buildStoreProjection(storeId))!;
    expect(projection.revoked).not.toContain(PC);
  });

  it("names the lottery installations D-26 retired, so a device token still alive dies", async () => {
    const { storeId, organizationId } = await fixture();
    await WorkerInstallationModel.create({
      workerInstallationId: "winst_retired",
      organizationId,
      storeId,
      product: "lottery",
      workerName: "StoreDesk Lottery",
      status: "revoked",
      contactEmail: "dana@example.com"
    });
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.revoked).toContain("winst_retired");
  });

  it("revokes somebody whose role carries no lottery page rather than sending them over", async () => {
    const { storeId, appUserId } = await fixture({ lotteryPages: false });
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.users).toEqual([]);
    expect(projection.access).toEqual([]);
    expect(projection.revoked).toContain(appUserId);
  });

  it("revokes somebody who was switched off, in the same breath", async () => {
    const { storeId, appUserId } = await fixture({ userStatus: "disabled" });
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.users).toEqual([]);
    expect(projection.revoked).toContain(appUserId);
  });

  it("says a store with no licence is not covered rather than leaving the field out", async () => {
    const { storeId, organizationId } = await fixture();
    await LicenseModel.updateOne({ organizationId }, { status: "cancelled", $unset: { coverageKey: 1 } });
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.licence.status).toBe("none");
    expect(projection.licence.expires_at).toBeNull();
  });

  it("goes up a version every time, so the cloud can drop anything older", async () => {
    const { storeId } = await fixture();
    const first = (await buildStoreProjection(storeId))!;
    await TenantStoreModel.updateOne({ storeId }, { $inc: { projectionVersion: 1 } });
    const second = (await buildStoreProjection(storeId))!;
    expect(second.version).toBe(first.version + 1);
  });

  it("answers nothing for a store that is not there, rather than half a projection", async () => {
    expect(await buildStoreProjection(publicId("str"))).toBeNull();
  });
});
