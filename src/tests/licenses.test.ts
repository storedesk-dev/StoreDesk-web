import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  VALID_ACKS,
  VALID_INSTALLATION,
  activatePc,
  call,
  createAdmin,
  lastAudit,
  request,
  type TestAdmin
} from "./helpers/api";
import { GET as listLicensesRoute, POST as createLicenseRoute } from "@/app/api/v1/admin/organizations/[organizationId]/licenses/route";
import { PATCH as patchLicenseRoute } from "@/app/api/v1/admin/organizations/[organizationId]/licenses/[licenseId]/route";
import { PUT as coverageRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/license/route";
import { POST as createStoreRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/route";
import { GET as setupRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup/route";
import { POST as issueKeyRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";
import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { createOrganization } from "@/lib/organizations";
import { LICENSE_NUMBER } from "@/lib/licenses";
import { migrateSubscriptionsToLicenses } from "@/lib/migrations";
import { scheduleNotify } from "@/lib/store-notify";
import { LegacySubscriptionModel, LicenseModel, TenantStoreModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-notify")>();
  return { ...actual, scheduleNotify: vi.fn(), scheduleAppUserNotify: vi.fn(), revokeInstallationsAndNotify: vi.fn(actual.revokeInstallationsAndNotify) };
});
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn()
}));

/**
 * Licenses (docs/design/control-plane-admin.md, "Licenses"): one organization
 * license with seats plus one store license per store, a covering license
 * per store (or none), the checks that follow from it, and the migration
 * from subscriptions.
 */

setupMemoryMongo();

const DAY = 86_400_000;
let admin: TestAdmin;
let organizationId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  organizationId = (await createOrganization(admin, { name: "Example Retail", slug: "example-retail" })).organization.organizationId;
});

const org = () => ({ organizationId });
const post = <T>(handler: T, body: unknown, params: Record<string, string> = org()) =>
  call(handler as Parameters<typeof call>[0], request("POST", "/", { token: admin.token, body }), params);

async function orgLicense(maxStores = 2, extra: Record<string, unknown> = {}) {
  const res = await post(createLicenseRoute, { scope: "organization", plan: "standard", maxStores, ...extra });
  expect(res.status).toBe(201);
  return res.body.license;
}

async function newStore(name: string, license: unknown = { mode: "organization" }) {
  return post(createStoreRoute, { name, license });
}

async function coverage(storeId: string, body: unknown) {
  return call(coverageRoute, request("PUT", "/", { token: admin.token, body }), { organizationId, storeId });
}

async function storeLicenseId(storeId: string) {
  return (await TenantStoreModel.findOne({ storeId }).lean())?.licenseId;
}

describe("creating licenses, one per scope", () => {
  it("creates an organization license with a readable number, and refuses a second one", async () => {
    const license = await orgLicense(5, { maxPcsPerStore: 2, offlineGraceDays: 10, notes: "Chain of 5" });
    expect(license).toMatchObject({ scope: "organization", status: "active", maxStores: 5, maxPcsPerStore: 2, offlineGraceDays: 10, seatsUsed: 0, notes: "Chain of 5" });
    expect(license.licenseNumber).toMatch(/^SD-ORG-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(await lastAudit("license.create")).toMatchObject({ targetId: license.licenseId, metadata: expect.objectContaining({ licenseNumber: license.licenseNumber }) });

    const second = await post(createLicenseRoute, { scope: "organization", plan: "trial" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("LICENSE_EXISTS");
    expect(second.body.error.message).toContain(license.licenseNumber);

    // Once cancelled, another may be created.
    await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { status: "cancelled" } }), { ...org(), licenseId: license.licenseId });
    expect((await post(createLicenseRoute, { scope: "organization", plan: "trial" })).status).toBe(201);
  });

  it("the database refuses a second non-cancelled license for the same scope, whatever the code does", async () => {
    await orgLicense();
    await expect(
      LicenseModel.create({
        organizationId,
        licenseId: "lic_dup",
        licenseNumber: "SD-ORG-DUP000",
        scope: "organization",
        plan: "standard",
        status: "active",
        startsAt: new Date(),
        entitlementExpiresAt: new Date(Date.now() + DAY),
        maxStores: 1,
        coverageKey: `org:${organizationId}`
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("a store license covers its store at once (freeing its seat) and a second one for that store is refused", async () => {
    await orgLicense(2);
    const store = (await newStore("Main St")).body.store;
    const license = (await post(createLicenseRoute, { scope: "store", storeId: store.storeId, plan: "trial" })).body.license;
    expect(license).toMatchObject({ scope: "store", storeId: store.storeId, storeName: "Main St", status: "trialing", maxStores: 1, seatsUsed: 1 });
    expect(license.licenseNumber).toMatch(LICENSE_NUMBER);
    expect(license.licenseNumber.startsWith("SD-STR-")).toBe(true);
    expect(await storeLicenseId(store.storeId)).toBe(license.licenseId);
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId: store.storeId, reason: "store.license.change" });

    const again = await post(createLicenseRoute, { scope: "store", storeId: store.storeId, plan: "standard" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LICENSE_EXISTS");
  });

  it.each([
    ["a store license without its store", { scope: "store", plan: "trial" }],
    ["a store license with 2 seats", { scope: "store", storeId: "store_x", plan: "trial", maxStores: 2 }],
    ["an organization license naming a store", { scope: "organization", storeId: "store_x", plan: "trial" }],
    ["31 days of grace", { scope: "organization", plan: "trial", offlineGraceDays: 31 }],
    ["an unknown field", { scope: "organization", plan: "trial", maxDevices: 3 }]
  ])("answers 400 for %s", async (_label, body) => {
    expect((await post(createLicenseRoute, body)).status).toBe(400);
  });

  it("answers 401 without a session and 404 for an unknown organization", async () => {
    expect((await call(listLicensesRoute, request("GET", "/"), org())).status).toBe(401);
    expect((await call(listLicensesRoute, request("GET", "/", { token: admin.token }), { organizationId: "org_nope" })).status).toBe(404);
  });

  it("lists both scopes with the stores each covers", async () => {
    await orgLicense(3);
    const a = (await newStore("A St")).body.store;
    await newStore("B St");
    await post(createLicenseRoute, { scope: "store", storeId: a.storeId, plan: "trial" });
    const res = await call(listLicensesRoute, request("GET", "/", { token: admin.token }), org());
    expect(res.body.licenses.map((license: { scope: string }) => license.scope)).toEqual(["organization", "store"]);
    expect(res.body.licenses[0]).toMatchObject({ seatsUsed: 1, coveredStores: [expect.objectContaining({ name: "B St" })] });
    expect(res.body.licenses[1]).toMatchObject({ storeName: "A St", seatsUsed: 1 });
  });
});

describe("seats", () => {
  it("refuses a store beyond the organization license's seats, on create and on switch", async () => {
    await orgLicense(2);
    expect((await newStore("One")).status).toBe(201);
    expect((await newStore("Two")).status).toBe(201);
    const full = await newStore("Three");
    expect(full.status).toBe(402);
    expect(full.body).toMatchObject({ error: { code: "LICENSE_SEATS_FULL" }, seatsUsed: 2, maxStores: 2 });
    expect(await TenantStoreModel.countDocuments({ name: "Three" })).toBe(0);

    const unlicensed = (await newStore("Four", { mode: "none" })).body.store;
    const switchFull = await coverage(unlicensed.storeId, { mode: "organization" });
    expect(switchFull.status).toBe(402);
    expect(await storeLicenseId(unlicensed.storeId)).toBeNull();
  });

  it("refuses lowering the seats below the stores on the license", async () => {
    const license = await orgLicense(2);
    await newStore("One");
    await newStore("Two");
    const res = await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { maxStores: 1 } }), { ...org(), licenseId: license.licenseId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LIMIT_BELOW_USAGE");
  });

  it("refuses the organization-license default when there is none", async () => {
    const res = await newStore("One");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_ORGANIZATION_LICENSE");
  });
});

describe("switching coverage", () => {
  it("moves a store between the organization license, its own license and none; leaving its own license cancels it", async () => {
    const license = await orgLicense(2);
    const store = (await newStore("Main St")).body.store;
    expect(store.license).toMatchObject({ licenseId: license.licenseId, scope: "organization" });

    const own = await coverage(store.storeId, { mode: "store", newLicense: { plan: "trial", entitlementDays: 30 } });
    expect(own.status).toBe(200);
    expect(own.body.store.license).toMatchObject({ scope: "store", plan: "trial", status: "trialing" });
    const ownId = own.body.store.license.licenseId;
    expect((await call(listLicensesRoute, request("GET", "/", { token: admin.token }), org())).body.licenses[0].seatsUsed).toBe(0);

    // Its own license again, without a new one: unchanged.
    expect((await coverage(store.storeId, { mode: "store" })).body.changed).toBe(false);

    const back = await coverage(store.storeId, { mode: "organization" });
    expect(back.body.store.license.licenseId).toBe(license.licenseId);
    expect((await LicenseModel.findOne({ licenseId: ownId }).lean())?.status).toBe("cancelled");
    expect(await lastAudit("license.cancel")).toMatchObject({ targetId: ownId, metadata: expect.objectContaining({ reason: "coverage switched" }) });
    expect((await lastAudit("store.license.change"))?.metadata).toMatchObject({ mode: "organization", from: ownId, to: license.licenseId });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId: store.storeId, reason: "store.license.change" });

    const none = await coverage(store.storeId, { mode: "none" });
    expect(none.body.store).toMatchObject({ licenseId: null, license: null });
  });

  it("asks for a new license when the store has none of its own, and refuses a second own license", async () => {
    await orgLicense(2);
    const store = (await newStore("Main St")).body.store;
    const missing = await coverage(store.storeId, { mode: "store" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("NEW_LICENSE_REQUIRED");
    await coverage(store.storeId, { mode: "store", newLicense: { plan: "trial" } });
    const twice = await coverage(store.storeId, { mode: "store", newLicense: { plan: "standard" } });
    expect(twice.status).toBe(409);
  });

  it("creates a store with its own license or with none", async () => {
    const own = await newStore("Hwy 9", { mode: "store", newLicense: { plan: "trial", entitlementDays: 30 } });
    expect(own.status).toBe(201);
    expect(own.body.store.license).toMatchObject({ scope: "store", plan: "trial" });
    const none = await newStore("Pine Rd", { mode: "none" });
    expect(none.body.store.license).toBeNull();
    expect((await newStore("X", { mode: "store" })).status).toBe(400);
  });
});

describe("what the covering license decides", () => {
  const acks = { acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION };

  it("an unlicensed store: no key, no activation, and the access pull is refused (403 STORE_UNLICENSED)", async () => {
    await orgLicense(2);
    const store = (await newStore("Main St")).body.store;
    const params = { organizationId, storeId: store.storeId };
    const key = await post(issueKeyRoute, { deliver: "show" }, params);
    expect(key.status).toBe(201);
    const pc = await activatePc(organizationId, store.storeId);
    await coverage(store.storeId, { mode: "none" });

    const setup = await call(setupRoute, request("GET", "/", { token: admin.token }), params);
    expect(setup.body.keyBlockedCode).toBe("STORE_UNLICENSED");
    expect((await post(issueKeyRoute, { deliver: "show" }, params)).body.error.code).toBe("STORE_UNLICENSED");
    const activation = await call(redeem, request("POST", "/", { body: { setupKey: key.body.setupKey, ...acks } }));
    expect(activation.status).toBe(402);
    expect(activation.body.error.code).toBe("STORE_UNLICENSED");
    const pull = await call(accessSync, request("GET", "/", { headers: { Authorization: `Bearer ${pc.token}` } }));
    expect(pull.status).toBe(403);
    expect(pull.body.error.code).toBe("STORE_UNLICENSED");
  });

  it("a suspended or lapsed organization license stops every store on it, not a store with its own license", async () => {
    const license = await orgLicense(3);
    const covered = (await newStore("Main St")).body.store;
    const ownStore = (await newStore("Hwy 9", { mode: "store", newLicense: { plan: "standard" } })).body.store;
    const coveredPc = await activatePc(organizationId, covered.storeId);
    const ownPc = await activatePc(organizationId, ownStore.storeId);
    const pull = (token: string) => call(accessSync, request("GET", "/", { headers: { Authorization: `Bearer ${token}` } }));

    vi.mocked(scheduleNotify).mockClear();
    await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { status: "suspended" } }), { ...org(), licenseId: license.licenseId });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeIds: [covered.storeId], reason: "license.change" });
    expect(await lastAudit("license.suspend")).toBeTruthy();
    expect((await pull(coveredPc.token)).body.subscription).toMatchObject({ status: "suspended", licenseNumber: license.licenseNumber, scope: "organization" });
    expect((await pull(ownPc.token)).body.subscription).toMatchObject({ status: "active", scope: "store" });
    const blocked = await call(setupRoute, request("GET", "/", { token: admin.token }), { organizationId, storeId: covered.storeId });
    expect(blocked.body.keyBlockedCode).toBe("LICENSE_INACTIVE");
    const fine = await call(setupRoute, request("GET", "/", { token: admin.token }), { organizationId, storeId: ownStore.storeId });
    expect(fine.body.keyBlockedCode).not.toBe("LICENSE_INACTIVE");

    // Resume, then let it lapse: expired on the next read.
    await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { status: "active" } }), { ...org(), licenseId: license.licenseId });
    expect(await lastAudit("license.resume")).toBeTruthy();
    await LicenseModel.updateOne({ licenseId: license.licenseId }, { $set: { entitlementExpiresAt: new Date(Date.now() - DAY) } });
    const listed = await call(listLicensesRoute, request("GET", "/", { token: admin.token }), org());
    expect(listed.body.licenses[0].status).toBe("expired");
    expect((await pull(coveredPc.token)).body.subscription.status).toBe("expired");
    expect((await pull(ownPc.token)).body.subscription.status).toBe("active");
    const key = await post(issueKeyRoute, { deliver: "show" }, { organizationId, storeId: covered.storeId });
    expect(key.status).toBe(402);
    expect(key.body.error.code).toBe("LICENSE_INACTIVE");

    // Renewing brings it back.
    const renewed = await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { renewDays: 365 } }), { ...org(), licenseId: license.licenseId });
    expect(renewed.body.license).toMatchObject({ status: "active", daysRemaining: 365 });
    expect(await lastAudit("license.renew")).toBeTruthy();
  });

  it("PCs per store come from the covering license", async () => {
    await orgLicense(2, { maxPcsPerStore: 1 });
    const store = (await newStore("Main St")).body.store;
    await activatePc(organizationId, store.storeId);
    const res = await post(issueKeyRoute, { deliver: "show" }, { organizationId, storeId: store.storeId });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("its license allows 1");
  });

  it("cancelling a license leaves its stores unlicensed and it can't be changed again", async () => {
    const license = await orgLicense(2);
    const store = (await newStore("Main St")).body.store;
    const cancelled = await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { status: "cancelled" } }), { ...org(), licenseId: license.licenseId });
    expect(cancelled.body.license).toMatchObject({ status: "cancelled", seatsUsed: 0 });
    expect(await storeLicenseId(store.storeId)).toBeNull();
    const again = await call(patchLicenseRoute, request("PATCH", "/", { token: admin.token, body: { renewDays: 30 } }), { ...org(), licenseId: license.licenseId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LICENSE_CANCELLED");
    const dash = await call(dashboardRoute, request("GET", "/", { token: admin.token }));
    expect(dash.body.counts.unlicensedStores).toBe(1);
    expect(dash.body.attention).toContainEqual(expect.objectContaining({ kind: "store_unlicensed", storeId: store.storeId }));
  });

  it("the dashboard lists licenses ending within 30 days", async () => {
    const license = await orgLicense(2, { entitlementDays: 10 });
    await newStore("Main St");
    const dash = await call(dashboardRoute, request("GET", "/", { token: admin.token }));
    expect(dash.body.counts.licensesEndingSoon).toBe(1);
    expect(dash.body.attention).toContainEqual(
      expect.objectContaining({ kind: "license_ending", licenseId: license.licenseId, licenseNumber: license.licenseNumber })
    );
  });
});

describe("migrating subscriptions to licenses", () => {
  async function legacy(organizationIdOf: string, subscriptionId: string, extra: Record<string, unknown> = {}) {
    await LegacySubscriptionModel.collection.insertOne({
      organizationId: organizationIdOf,
      subscriptionId,
      plan: "standard",
      status: "active",
      startsAt: new Date(Date.now() - 10 * DAY),
      supportEndsAt: new Date(Date.now() + 100 * DAY),
      entitlementExpiresAt: new Date(Date.now() + 100 * DAY),
      offlineGraceDays: 5,
      maxStores: 3,
      maxWorkerInstallations: 2,
      createdAt: new Date(Date.now() - 10 * DAY),
      ...extra
    });
  }
  async function legacyStore(storeId: string, subscriptionId: string | null) {
    await TenantStoreModel.collection.insertOne({
      organizationId: "org_old",
      storeId,
      name: storeId,
      status: "active",
      ...(subscriptionId ? { subscriptionId } : {})
    });
  }

  it("turns subscriptions into licenses with the same ids, links stores, and changes nothing on a second run", async () => {
    await legacy("org_old", "sub_main");
    await legacy("org_old", "sub_single", { entitlementExpiresAt: new Date(Date.now() + 50 * DAY) });
    await legacy("org_old", "sub_multi", { entitlementExpiresAt: new Date(Date.now() + 40 * DAY), maxStores: 5 });
    await legacy("org_old", "sub_old", { status: "cancelled" });
    await legacyStore("s1", "sub_main");
    await legacyStore("s2", "sub_main");
    await legacyStore("s3", "sub_single");
    await legacyStore("s4", "sub_multi");
    await legacyStore("s5", "sub_multi");
    await legacyStore("s6", "sub_old");
    await legacyStore("s7", "sub_gone");

    const report = await migrateSubscriptionsToLicenses();
    expect(report).toMatchObject({ organizationLicenses: 2, storeLicenses: 1, merged: 1 });

    const main = await LicenseModel.findOne({ licenseId: "sub_main" }).lean();
    expect(main).toMatchObject({ scope: "organization", status: "active", maxPcsPerStore: 2, offlineGraceDays: 5, coverageKey: "org:org_old" });
    expect(main?.licenseNumber).toMatch(LICENSE_NUMBER);
    expect(await LicenseModel.findOne({ licenseId: "sub_single" }).lean()).toMatchObject({ scope: "store", storeId: "s3", maxStores: 1 });
    expect(await LicenseModel.findOne({ licenseId: "sub_multi" }).lean()).toMatchObject({ status: "cancelled" });
    expect(await LicenseModel.findOne({ licenseId: "sub_old" }).lean()).toMatchObject({ status: "cancelled", scope: "organization" });

    const link = async (storeId: string) => (await TenantStoreModel.findOne({ storeId }).lean())?.licenseId;
    expect(await link("s1")).toBe("sub_main");
    expect(await link("s2")).toBe("sub_main");
    expect(await link("s3")).toBe("sub_single");
    // The stores of a second multi-store subscription moved onto the organization license, whose seats grew.
    expect(await link("s4")).toBe("sub_main");
    expect(await link("s5")).toBe("sub_main");
    expect((await LicenseModel.findOne({ licenseId: "sub_main" }).lean())?.maxStores).toBe(4);
    expect(await link("s6")).toBeNull();
    expect(await link("s7")).toBeNull();

    const count = await LicenseModel.countDocuments();
    const second = await migrateSubscriptionsToLicenses();
    expect(second).toEqual({ organizationLicenses: 0, storeLicenses: 0, merged: 0, storesLinked: 0, storesUnlicensed: 0 });
    expect(await LicenseModel.countDocuments()).toBe(count);
  });

  it("reads an unmigrated store's old subscriptionId until it is linked", async () => {
    const license = await orgLicense(2);
    await TenantStoreModel.collection.insertOne({ organizationId, storeId: "s_old", name: "Old", status: "active", subscriptionId: license.licenseId });
    const listed = await call(listLicensesRoute, request("GET", "/", { token: admin.token }), org());
    expect(listed.body.licenses[0].coveredStores).toEqual([{ storeId: "s_old", name: "Old" }]);
  });
});
