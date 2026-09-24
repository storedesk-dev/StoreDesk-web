import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";
import { DEVICE_TTL_SECONDS, mintSupabaseToken, readSupabaseToken } from "@/lib/supabase-token";
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

describe("the token the control plane mints", () => {
  it("can only ever be an ordinary authenticated token", () => {
    const { token } = mintSupabaseToken({ kind: "device", org: "org-1", store: "store-1", sub: "dev-1" });
    const body = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8"));
    expect(body.role).toBe("authenticated");
    expect(JSON.stringify(body)).not.toContain("service_role");
  });

  it("carries the store a PC is bound to, and the stores a person may reach", () => {
    const device = readSupabaseToken(mintSupabaseToken({ kind: "device", org: "org-1", store: "store-1", sub: "dev-1" }).token);
    expect(device.claims).toMatchObject({ kind: "device", store: "store-1" });

    const person = readSupabaseToken(
      mintSupabaseToken({
        kind: "user",
        org: "org-1",
        user: "user-1",
        email: "dana@example.com",
        stores: ["store-1", "store-2"],
        pages: ["lottery"]
      }).token
    );
    expect(person.claims).toMatchObject({ kind: "user", stores: ["store-1", "store-2"], pages: ["lottery"] });
  });

  it("gives a PC an hour and a person a quarter of one", () => {
    const device = mintSupabaseToken({ kind: "device", org: "org-1", store: "store-1", sub: "dev-1" });
    const person = mintSupabaseToken({ kind: "user", org: "org-1", user: "u", email: "e@x.com", stores: [], pages: [] });
    const seconds = (at: Date) => Math.round((at.getTime() - Date.now()) / 1000);
    expect(seconds(device.expiresAt)).toBeGreaterThan(DEVICE_TTL_SECONDS - 5);
    expect(seconds(person.expiresAt)).toBeLessThan(16 * 60);
  });

  it("refuses a token somebody edited", () => {
    const { token } = mintSupabaseToken({ kind: "device", org: "org-1", store: "store-1", sub: "dev-1" });
    const [header, payload, signature] = token.split(".");
    const tampered = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    tampered.sd.store = "another-store";
    const forged = `${header}.${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${signature}`;
    expect(() => readSupabaseToken(forged)).toThrow(/not valid/);
  });

  it("refuses a token that has run out", () => {
    const { token } = mintSupabaseToken({ kind: "device", org: "org-1", store: "store-1", sub: "dev-1" }, -10);
    expect(() => readSupabaseToken(token)).toThrow(/expired/);
  });

  it("will not mint anything at all when the cloud is not set up", () => {
    delete process.env.SUPABASE_JWT_SECRET;
    expect(() => mintSupabaseToken({ kind: "device", org: "o", store: "s", sub: "d" })).toThrow(/not configured/);
  });
});

// ── the projection ───────────────────────────────────────────────────────────

const PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$abcdefgh$ijklmnop";

async function fixture(options: { lotteryPages?: boolean; userStatus?: string } = {}) {
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
          lottery: { pages: options.lotteryPages === false ? [] : [{ key: "lottery", enabled: true, featureFlags: {} }] },
          electron: { pages: [{ key: "pos", enabled: true, featureFlags: {} }] }
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

  await WorkerInstallationModel.create({
    workerInstallationId: publicId("winst"),
    organizationId,
    storeId,
    product: "lottery",
    workerName: "StoreDesk Lottery",
    status: "active",
    contactEmail: "dana@example.com"
  });

  return { organizationId, storeId, appUserId };
}

describe("what the control plane tells the lottery cloud", () => {
  it("carries the store, its licence, its people and what they may do", async () => {
    const { storeId, appUserId } = await fixture();
    const projection = (await buildStoreProjection(storeId))!;

    expect(projection.store).toMatchObject({ id: storeId, name: "Store 42", time_zone: "America/New_York", cloud_mode: "cloud" });
    expect(projection.licence).toMatchObject({ status: "active", number: "SD-STR-7K3Q92", scope: "store", offline_grace_days: 7 });
    expect(projection.users).toEqual([
      { id: appUserId, email: "dana@example.com", name: "Dana Patel", status: "active", password_hash: PASSWORD_HASH }
    ]);
    expect(projection.access).toEqual([{ user_id: appUserId, role: "clerk", pages: ["lottery"] }]);
    expect(projection.device).toMatchObject({ status: "active", device_name: "StoreDesk Lottery" });
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
    expect(Object.keys(projection.device!).sort()).toEqual([...projectionFields.device].sort());
  });

  it("carries the password hash, because that is what lets a PC sign somebody in with the line down", async () => {
    const { storeId } = await fixture();
    const projection = (await buildStoreProjection(storeId))!;
    expect(projection.users[0]?.password_hash).toBe(PASSWORD_HASH);
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
