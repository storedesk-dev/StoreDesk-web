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
import { PUT as storeLicenseRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/license/route";
import { POST as modeRoute } from "@/app/api/v1/admin/organizations/[organizationId]/licensing/mode/route";
import { POST as createStoreRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/route";
import { POST as createOrgRoute } from "@/app/api/v1/admin/organizations/route";
import { GET as setupRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup/route";
import { POST as issueKeyRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";
import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { createOrganization } from "@/lib/organizations";
import { LICENSE_NUMBER, coveringLicense } from "@/lib/licenses";
import { migrateLicensingModes, migrateSubscriptionsToLicenses } from "@/lib/migrations";
import { scheduleNotify } from "@/lib/store-notify";
import { AuditEventModel, LegacySubscriptionModel, LicenseModel, OrganizationModel, TenantStoreModel } from "@/models/ControlPlane";

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
 * Licensing modes (docs/design/control-plane-admin.md, "Licenses"): a master
 * license covering every store, or a license per store; coverage derived from
 * the mode; switching mode (dry run, copy, atomic); the checks that follow;
 * and the migrations.
 */

setupMemoryMongo();

const DAY = 86_400_000;
let admin: TestAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
});

const as = (method: string, body?: unknown) => request(method, "/", { token: admin.token, ...(body === undefined ? {} : { body }) });

async function masterOrg(slug = "example-retail", terms: Record<string, unknown> = {}) {
  const { organization, license } = await createOrganization(admin, {
    name: "Example Retail",
    slug,
    license: { plan: "standard", maxPcsPerStore: 1, offlineGraceDays: 7, ...terms }
  });
  return { organizationId: organization.organizationId, master: license! };
}

async function storeWiseOrg(slug = "corner-mart") {
  const { organization } = await createOrganization(admin, { name: "Corner Mart Group", slug, licensingMode: "storeWise" });
  return organization.organizationId;
}

async function newStore(organizationId: string, name: string, extra: Record<string, unknown> = {}) {
  return call(createStoreRoute, as("POST", { name, ...extra }), { organizationId });
}
const list = (organizationId: string) => call(listLicensesRoute, as("GET"), { organizationId });
const patch = (organizationId: string, licenseId: string, body: unknown) =>
  call(patchLicenseRoute, as("PATCH", body), { organizationId, licenseId });
const storeLicense = (organizationId: string, storeId: string, body: unknown) =>
  call(storeLicenseRoute, as("PUT", body), { organizationId, storeId });
const switchMode = (organizationId: string, body: unknown) => call(modeRoute, as("POST", body), { organizationId });
const pull = (token: string) => call(accessSync, request("GET", "/", { headers: { Authorization: `Bearer ${token}` } }));

describe("master mode", () => {
  it("the master covers every store, including stores added later, with no store limit", async () => {
    const { organizationId, master } = await masterOrg();
    expect(master.licenseNumber).toMatch(/^SD-ORG-[0-9A-HJKMNP-TV-Z]{6}$/);
    for (let i = 1; i <= 7; i += 1) {
      const created = await newStore(organizationId, `Store ${i}`);
      expect(created.status).toBe(201);
      expect(created.body.store.license).toMatchObject({ licenseId: master.licenseId, scope: "organization" });
    }
    const listed = await list(organizationId);
    expect(listed.body.licensingMode).toBe("master");
    expect(listed.body.licenses[0].coveredStores).toHaveLength(7);
    expect(listed.body.licenses[0]).not.toHaveProperty("maxStores");
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "license.change" });
  });

  it("refuses anything that doesn't fit the mode with 409 LICENSE_MODE_MISMATCH", async () => {
    const { organizationId, master } = await masterOrg();
    const store = (await newStore(organizationId, "Main St")).body.store;
    const cases = [
      await call(createLicenseRoute, as("POST", { scope: "store", storeId: store.storeId, plan: "trial" }), { organizationId }),
      await call(createLicenseRoute, as("POST", { scope: "organization", plan: "trial" }), { organizationId }),
      await storeLicense(organizationId, store.storeId, { plan: "trial", entitlementDays: 30 }),
      await newStore(organizationId, "Hwy 9", { storeLicense: { plan: "trial" } })
    ];
    for (const res of cases) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LICENSE_MODE_MISMATCH");
      expect(res.body.licensingMode).toBe("master");
    }
    expect(cases[1].body.error.message).toContain(master.licenseNumber);
    expect(await TenantStoreModel.countDocuments({ name: "Hwy 9" })).toBe(0);
  });

  it("the database refuses a second non-cancelled master, whatever the code does", async () => {
    const { organizationId } = await masterOrg();
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
        coverageKey: `org:${organizationId}`
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("a suspended or lapsed master stops every store; renewing brings them back", async () => {
    const { organizationId, master } = await masterOrg();
    const a = (await newStore(organizationId, "A St")).body.store;
    const b = (await newStore(organizationId, "B St")).body.store;
    const pc = await activatePc(organizationId, a.storeId);

    vi.mocked(scheduleNotify).mockClear();
    await patch(organizationId, master.licenseId, { status: "suspended" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeIds: [a.storeId, b.storeId], reason: "license.change" });
    expect(await lastAudit("license.suspend")).toBeTruthy();
    expect((await pull(pc.token)).body.subscription).toMatchObject({ status: "suspended", licenseNumber: master.licenseNumber, scope: "organization" });
    const blocked = await call(setupRoute, as("GET"), { organizationId, storeId: b.storeId });
    expect(blocked.body.keyBlockedCode).toBe("LICENSE_INACTIVE");

    await patch(organizationId, master.licenseId, { status: "active" });
    await LicenseModel.updateOne({ licenseId: master.licenseId }, { $set: { entitlementExpiresAt: new Date(Date.now() - DAY) } });
    expect((await list(organizationId)).body.licenses[0].status).toBe("expired");
    expect((await pull(pc.token)).body.subscription.status).toBe("expired");
    const key = await call(issueKeyRoute, as("POST", { deliver: "show" }), { organizationId, storeId: b.storeId });
    expect(key.status).toBe(402);
    expect(key.body.error.code).toBe("LICENSE_INACTIVE");

    const renewed = await patch(organizationId, master.licenseId, { renewDays: 365 });
    expect(renewed.body.license).toMatchObject({ status: "active", daysRemaining: 365 });
    expect((await pull(pc.token)).body.subscription.status).toBe("active");
  });

  it("cancelling the master leaves every store Unlicensed: no key, no activation, access pull 403", async () => {
    const { organizationId, master } = await masterOrg();
    const store = (await newStore(organizationId, "Main St")).body.store;
    const params = { organizationId, storeId: store.storeId };
    const key = await call(issueKeyRoute, as("POST", { deliver: "show" }), params);
    expect(key.status).toBe(201);
    const pc = await activatePc(organizationId, store.storeId);

    const cancelled = await patch(organizationId, master.licenseId, { status: "cancelled" });
    expect(cancelled.body.license).toMatchObject({ status: "cancelled", coveredStores: [] });
    expect((await patch(organizationId, master.licenseId, { renewDays: 30 })).body.error.code).toBe("LICENSE_CANCELLED");

    const setup = await call(setupRoute, as("GET"), params);
    expect(setup.body.keyBlockedCode).toBe("STORE_UNLICENSED");
    expect(setup.body.keyBlockedReason).toContain("master license");
    const activation = await call(redeem, request("POST", "/", { body: { setupKey: key.body.setupKey, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION } }));
    expect(activation.status).toBe(402);
    expect(activation.body.error.code).toBe("STORE_UNLICENSED");
    expect(activation.body.error.message).toBe("This store has no active StoreDesk license.");
    const refused = await pull(pc.token);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toMatchObject({ code: "STORE_UNLICENSED", message: "This store has no active StoreDesk license." });

    const dash = await call(dashboardRoute, as("GET"));
    expect(dash.body.counts.unlicensedStores).toBe(1);
    expect(dash.body.attention).toContainEqual(expect.objectContaining({ kind: "store_unlicensed", storeId: store.storeId }));

    // A new master may be added, and covers the store again.
    expect((await call(createLicenseRoute, as("POST", { scope: "organization", plan: "trial" }), { organizationId })).status).toBe(201);
    expect((await pull(pc.token)).status).toBe(200);
  });

  it("PCs per store come from the master, and the dashboard lists it ending", async () => {
    const { organizationId, master } = await masterOrg("example-retail", { entitlementDays: 10 });
    const store = (await newStore(organizationId, "Main St")).body.store;
    await activatePc(organizationId, store.storeId);
    const res = await call(issueKeyRoute, as("POST", { deliver: "show" }), { organizationId, storeId: store.storeId });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("its license allows 1");
    const dash = await call(dashboardRoute, as("GET"));
    expect(dash.body.counts.licensesEndingSoon).toBe(1);
    expect(dash.body.attention).toContainEqual(
      expect.objectContaining({ kind: "license_ending", licenseId: master.licenseId, licenseNumber: master.licenseNumber })
    );
  });
});

describe("store-wise mode", () => {
  it("each store has its own license or none; issue, edit, and one per store", async () => {
    const organizationId = await storeWiseOrg();
    const five = await newStore(organizationId, "Store 5", { storeLicense: { plan: "standard", entitlementDays: 365 } });
    expect(five.status).toBe(201);
    expect(five.body.store.license).toMatchObject({ scope: "store", plan: "standard", status: "active" });
    expect(five.body.store.license.licenseNumber).toMatch(LICENSE_NUMBER);
    expect(five.body.store.license.licenseNumber.startsWith("SD-STR-")).toBe(true);
    const six = await newStore(organizationId, "Store 6");
    expect(six.body.store).toMatchObject({ licenseId: null, license: null });

    const issued = await storeLicense(organizationId, six.body.store.storeId, { plan: "trial", entitlementDays: 30 });
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ created: true, licensingMode: "storeWise", license: { scope: "store", status: "trialing" } });
    const edited = await storeLicense(organizationId, six.body.store.storeId, { renewDays: 30, maxPcsPerStore: 2 });
    expect(edited.body).toMatchObject({ created: false, license: { maxPcsPerStore: 2 } });
    expect(await lastAudit("license.renew")).toBeTruthy();

    const again = await call(createLicenseRoute, as("POST", { scope: "store", storeId: six.body.store.storeId, plan: "trial" }), { organizationId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LICENSE_EXISTS");
    const noMaster = await call(createLicenseRoute, as("POST", { scope: "organization", plan: "trial" }), { organizationId });
    expect(noMaster.status).toBe(409);
    expect(noMaster.body.error.code).toBe("LICENSE_MODE_MISMATCH");
  });

  it("an Unlicensed store gets no key and no activation, and its access pull is refused", async () => {
    const organizationId = await storeWiseOrg();
    const store = (await newStore(organizationId, "Store 5", { storeLicense: { plan: "standard" } })).body.store;
    const params = { organizationId, storeId: store.storeId };
    const key = await call(issueKeyRoute, as("POST", { deliver: "show" }), params);
    expect(key.status).toBe(201);
    const pc = await activatePc(organizationId, store.storeId);
    expect((await pull(pc.token)).body.subscription).toMatchObject({ status: "active", scope: "store", licenseNumber: store.license.licenseNumber });

    await patch(organizationId, store.license.licenseId, { status: "cancelled" });
    const setup = await call(setupRoute, as("GET"), params);
    expect(setup.body.keyBlockedCode).toBe("STORE_UNLICENSED");
    expect((await call(issueKeyRoute, as("POST", { deliver: "show" }), params)).body.error.code).toBe("STORE_UNLICENSED");
    const activation = await call(redeem, request("POST", "/", { body: { setupKey: key.body.setupKey, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION } }));
    expect(activation.status).toBe(402);
    expect(activation.body.error.code).toBe("STORE_UNLICENSED");
    expect((await pull(pc.token)).status).toBe(403);
  });

  it("one store's license affects only that store", async () => {
    const organizationId = await storeWiseOrg();
    const a = (await newStore(organizationId, "A", { storeLicense: { plan: "standard" } })).body.store;
    const b = (await newStore(organizationId, "B", { storeLicense: { plan: "standard" } })).body.store;
    const pcB = await activatePc(organizationId, b.storeId);
    vi.mocked(scheduleNotify).mockClear();
    await patch(organizationId, a.license.licenseId, { status: "suspended" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeIds: [a.storeId], reason: "license.change" });
    expect((await pull(pcB.token)).body.subscription.status).toBe("active");
  });

  it("organization create: the mode's defaults and the combinations it refuses", async () => {
    const post = (body: unknown) => call(createOrgRoute, as("POST", body));
    const wise = await post({ name: "A", slug: "a-org" });
    expect(wise.status).toBe(201);
    expect(wise.body.organization.licensingMode).toBe("storeWise");
    expect(wise.body.license).toBeNull();
    const master = await post({ name: "B", slug: "b-org", license: { plan: "trial" } });
    expect(master.body.organization.licensingMode).toBe("master");
    expect((await post({ name: "C", slug: "c-org", licensingMode: "master" })).body.error.code).toBe("MASTER_LICENSE_REQUIRED");
    expect((await post({ name: "D", slug: "d-org", licensingMode: "storeWise", license: { plan: "trial" } })).status).toBe(400);
    expect((await post({ name: "E", slug: "e-org", license: { plan: "trial", maxStores: 5 } })).status).toBe(400);
    expect(await OrganizationModel.countDocuments({ slug: { $in: ["c-org", "d-org", "e-org"] } })).toBe(0);
  });

  it.each([
    ["a store license without its store", { scope: "store", plan: "trial" }],
    ["a master naming a store", { scope: "organization", storeId: "store_x", plan: "trial" }],
    ["31 days of grace", { scope: "store", storeId: "store_x", plan: "trial", offlineGraceDays: 31 }],
    ["seats", { scope: "store", storeId: "store_x", plan: "trial", maxStores: 2 }]
  ])("answers 400 for %s", async (_label, body) => {
    const organizationId = await storeWiseOrg();
    expect((await call(createLicenseRoute, as("POST", body), { organizationId })).status).toBe(400);
  });
});

describe("switching mode", () => {
  it("master → store-wise: the dry run writes nothing; the real run copies the master to every store and cancels it", async () => {
    const { organizationId, master } = await masterOrg("example-retail", { maxPcsPerStore: 2, offlineGraceDays: 5, plan: "custom" });
    const a = (await newStore(organizationId, "A St")).body.store;
    const b = (await newStore(organizationId, "B St")).body.store;
    const pc = await activatePc(organizationId, a.storeId);
    const before = await LicenseModel.countDocuments();

    const dry = await switchMode(organizationId, { mode: "storeWise", dryRun: true });
    expect(dry.status).toBe(200);
    expect(dry.body).toMatchObject({ dryRun: true, from: "master", to: "storeWise", copyToStores: true });
    expect(dry.body.stores).toHaveLength(2);
    expect(dry.body.stores[0]).toMatchObject({
      name: "A St",
      before: { scope: "organization", licenseNumber: master.licenseNumber },
      after: { scope: "store", licenseNumber: null, plan: "custom", status: "active", entitlementExpiresAt: master.entitlementExpiresAt },
      createsLicense: true
    });
    expect(dry.body.licenses.created).toHaveLength(2);
    expect(dry.body.licenses.cancelled).toEqual([expect.objectContaining({ licenseNumber: master.licenseNumber })]);
    expect(await LicenseModel.countDocuments()).toBe(before);
    expect((await OrganizationModel.findOne({ organizationId }).lean())?.licensing).toEqual({ mode: "master" });

    vi.mocked(scheduleNotify).mockClear();
    const done = await switchMode(organizationId, { mode: "storeWise" });
    expect(done.status).toBe(200);
    expect(done.body.dryRun).toBe(false);
    expect(done.body.stores.every((row: { after: { licenseNumber: string } }) => row.after.licenseNumber.startsWith("SD-STR-"))).toBe(true);
    expect((await OrganizationModel.findOne({ organizationId }).lean())?.licensing).toEqual({ mode: "storeWise" });
    const cancelledMaster = await LicenseModel.findOne({ licenseId: master.licenseId }).lean();
    expect(cancelledMaster?.status).toBe("cancelled");
    expect(cancelledMaster?.coverageKey).toBeUndefined();
    for (const store of [a, b]) {
      const own = await coveringLicense({ organizationId, storeId: store.storeId });
      expect(own).toMatchObject({ scope: "store", storeId: store.storeId, plan: "custom", status: "active", offlineGraceDays: 5, maxPcsPerStore: 2 });
      expect((own?.entitlementExpiresAt as Date).toISOString()).toBe(master.entitlementExpiresAt);
    }
    expect((await pull(pc.token)).body.subscription).toMatchObject({ scope: "store", status: "active" });
    expect((await lastAudit("organization.licensing.change"))?.metadata).toMatchObject({ from: "master", to: "storeWise", copyToStores: true });
    expect(await AuditEventModel.countDocuments({ action: "license.create", "metadata.reason": "licensing switched to storeWise" })).toBe(2);
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "license.change" });

    const again = await switchMode(organizationId, { mode: "storeWise" });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LICENSING_MODE_UNCHANGED");
  });

  it("master → store-wise without copying leaves every store Unlicensed", async () => {
    const { organizationId, master } = await masterOrg();
    const store = (await newStore(organizationId, "A St")).body.store;
    const dry = await switchMode(organizationId, { mode: "storeWise", copyToStores: false, dryRun: true });
    expect(dry.body.stores[0]).toMatchObject({ before: { scope: "organization" }, after: null, createsLicense: false });
    expect(dry.body.licenses.created).toEqual([]);
    await switchMode(organizationId, { mode: "storeWise", copyToStores: false });
    expect(await coveringLicense({ organizationId, storeId: store.storeId })).toBeNull();
    expect((await LicenseModel.findOne({ licenseId: master.licenseId }).lean())?.status).toBe("cancelled");
    expect((await list(organizationId)).body.licensingMode).toBe("storeWise");
  });

  it("store-wise → master: store licenses are superseded, the new master covers every store", async () => {
    const organizationId = await storeWiseOrg();
    const licensed = (await newStore(organizationId, "Store 5", { storeLicense: { plan: "standard" } })).body.store;
    const unlicensed = (await newStore(organizationId, "Store 6")).body.store;

    const missing = await switchMode(organizationId, { mode: "master" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("MASTER_LICENSE_REQUIRED");

    const terms = { plan: "standard", entitlementDays: 200, maxPcsPerStore: 3, offlineGraceDays: 10 };
    const dry = await switchMode(organizationId, { mode: "master", master: terms, dryRun: true });
    expect(dry.body.stores).toEqual([
      expect.objectContaining({ storeId: licensed.storeId, before: expect.objectContaining({ scope: "store" }), after: expect.objectContaining({ scope: "organization", licenseNumber: null }) }),
      expect.objectContaining({ storeId: unlicensed.storeId, before: null, after: expect.objectContaining({ scope: "organization" }) })
    ]);
    expect(dry.body.licenses.cancelled).toEqual([expect.objectContaining({ licenseNumber: licensed.license.licenseNumber, reason: "superseded by master license" })]);
    expect(await coveringLicense({ organizationId, storeId: unlicensed.storeId })).toBeNull();

    const done = await switchMode(organizationId, { mode: "master", master: terms });
    expect(done.body.master).toMatchObject({ scope: "organization", maxPcsPerStore: 3, offlineGraceDays: 10, daysRemaining: 200 });
    const superseded = await LicenseModel.findOne({ licenseId: licensed.license.licenseId }).lean();
    expect(superseded).toMatchObject({ status: "cancelled", notes: "superseded by master license" });
    for (const store of [licensed, unlicensed]) {
      expect(await coveringLicense({ organizationId, storeId: store.storeId })).toMatchObject({ licenseId: done.body.master.licenseId });
    }
    expect(await lastAudit("license.cancel")).toMatchObject({ targetId: licensed.license.licenseId, metadata: expect.objectContaining({ reason: "superseded by master license" }) });
  });
});

describe("migrations", () => {
  async function orgWithoutMode(organizationId: string) {
    await OrganizationModel.collection.insertOne({ organizationId, name: organizationId, slug: organizationId, status: "active", roles: [] });
  }
  async function rawStore(organizationId: string, storeId: string, extra: Record<string, unknown> = {}) {
    await TenantStoreModel.collection.insertOne({ organizationId, storeId, name: storeId, status: "active", ...extra });
  }
  async function rawLicense(organizationId: string, licenseId: string, scope: "organization" | "store", storeId?: string) {
    await LicenseModel.collection.insertOne({
      organizationId,
      licenseId,
      licenseNumber: `SD-${scope === "organization" ? "ORG" : "STR"}-${licenseId.slice(-6).toUpperCase().padStart(6, "0")}`,
      scope,
      ...(storeId ? { storeId } : {}),
      plan: "standard",
      status: "active",
      startsAt: new Date(),
      entitlementExpiresAt: new Date(Date.now() + 100 * DAY),
      maxStores: 3,
      maxPcsPerStore: 1,
      offlineGraceDays: 7,
      coverageKey: scope === "organization" ? `org:${organizationId}` : `store:${storeId}`
    });
  }
  async function legacy(organizationId: string, subscriptionId: string, extra: Record<string, unknown> = {}) {
    await LegacySubscriptionModel.collection.insertOne({
      organizationId,
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

  it("subscriptions become a master license (the best one) and cancelled ones; the organization becomes master", async () => {
    await orgWithoutMode("org_old");
    await legacy("org_old", "sub_main");
    await legacy("org_old", "sub_second", { entitlementExpiresAt: new Date(Date.now() + 40 * DAY) });
    await legacy("org_old", "sub_gone", { status: "cancelled" });
    await rawStore("org_old", "s1", { subscriptionId: "sub_main", licenseId: "sub_main" });
    await rawStore("org_old", "s2", { subscriptionId: "sub_second" });

    expect(await migrateSubscriptionsToLicenses()).toEqual({ masterLicenses: 1, cancelledLicenses: 2 });
    const main = await LicenseModel.findOne({ licenseId: "sub_main" }).lean();
    expect(main).toMatchObject({ scope: "organization", status: "active", maxPcsPerStore: 2, offlineGraceDays: 5, coverageKey: "org:org_old" });
    expect(main?.licenseNumber).toMatch(LICENSE_NUMBER);
    expect(await LicenseModel.findOne({ licenseId: "sub_second" }).lean()).toMatchObject({ status: "cancelled", scope: "organization" });

    expect(await migrateLicensingModes()).toMatchObject({ master: 1, storeWise: 0, storesUnlinked: 2 });
    expect((await OrganizationModel.findOne({ organizationId: "org_old" }).lean())?.licensing).toEqual({ mode: "master" });
    for (const storeId of ["s1", "s2"]) {
      expect(await coveringLicense({ organizationId: "org_old", storeId })).toMatchObject({ licenseId: "sub_main" });
      const raw = await TenantStoreModel.collection.findOne({ storeId });
      expect(raw).not.toHaveProperty("licenseId");
      expect(raw).not.toHaveProperty("subscriptionId");
    }

    const count = await LicenseModel.countDocuments();
    expect(await migrateSubscriptionsToLicenses()).toEqual({ masterLicenses: 0, cancelledLicenses: 0 });
    expect(await migrateLicensingModes()).toEqual({ master: 0, storeWise: 0, supersededStoreLicenses: 0, storesUnlinked: 0 });
    expect(await LicenseModel.countDocuments()).toBe(count);
  });

  it("an organization with a master and store licenses becomes master; the store licenses are superseded and audited", async () => {
    await orgWithoutMode("org_mixed");
    await rawLicense("org_mixed", "lic_master", "organization");
    await rawLicense("org_mixed", "lic_str_a", "store", "sa");
    await rawStore("org_mixed", "sa", { licenseId: "lic_str_a" });
    await rawStore("org_mixed", "sb", { licenseId: null });

    expect(await migrateLicensingModes()).toMatchObject({ master: 1, supersededStoreLicenses: 1 });
    expect(await LicenseModel.findOne({ licenseId: "lic_str_a" }).lean()).toMatchObject({ status: "cancelled", notes: "superseded by master license" });
    expect(await AuditEventModel.findOne({ action: "license.cancel", targetId: "lic_str_a" }).lean()).toMatchObject({
      actorType: "system",
      metadata: expect.objectContaining({ reason: "superseded by master license" })
    });
    for (const storeId of ["sa", "sb"]) {
      expect(await coveringLicense({ organizationId: "org_mixed", storeId })).toMatchObject({ licenseId: "lic_master" });
    }
  });

  it("only store licenses → store-wise; neither → store-wise with every store Unlicensed", async () => {
    await orgWithoutMode("org_wise");
    await rawLicense("org_wise", "lic_str_w", "store", "w1");
    await rawStore("org_wise", "w1");
    await rawStore("org_wise", "w2");
    await orgWithoutMode("org_none");
    await rawStore("org_none", "n1");

    expect(await migrateLicensingModes()).toMatchObject({ master: 0, storeWise: 2 });
    expect((await OrganizationModel.findOne({ organizationId: "org_wise" }).lean())?.licensing).toEqual({ mode: "storeWise" });
    expect(await coveringLicense({ organizationId: "org_wise", storeId: "w1" })).toMatchObject({ licenseId: "lic_str_w" });
    expect(await coveringLicense({ organizationId: "org_wise", storeId: "w2" })).toBeNull();
    expect(await coveringLicense({ organizationId: "org_none", storeId: "n1" })).toBeNull();
  });

  it("before the migration reaches an organization, its mode is read from its licenses", async () => {
    await orgWithoutMode("org_later");
    await rawLicense("org_later", "lic_later", "organization");
    await rawStore("org_later", "l1");
    expect(await coveringLicense({ organizationId: "org_later", storeId: "l1" })).toMatchObject({ licenseId: "lic_later" });
  });
});
