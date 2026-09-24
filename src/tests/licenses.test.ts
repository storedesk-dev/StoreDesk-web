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
import { POST as createStoreRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/route";
import { POST as createOrgRoute } from "@/app/api/v1/admin/organizations/route";
import { GET as setupRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup/route";
import { POST as issueKeyRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";
import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { createOrganization } from "@/lib/organizations";
import { LICENSE_NUMBER, coveringLicense } from "@/lib/licenses";
import { migrateStoreScopedLicenses } from "@/lib/migrations";
import { scheduleNotify } from "@/lib/store-notify";
import { LicenseModel } from "@/models/ControlPlane";

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
 * Licensing (docs/design/control-plane-admin.md, "Licenses"): a store has its own
 * license or none (D-22). Issuing, editing and cancelling one, what an Unlicensed
 * store cannot do, and that one store's license never reaches another.
 */

setupMemoryMongo();

const DAY = 86_400_000;
let admin: TestAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
});

const as = (method: string, body?: unknown) => request(method, "/", { token: admin.token, ...(body === undefined ? {} : { body }) });

/** An organization holds stores and nothing else; a licence belongs to a store (D-22). */
async function newOrg(slug = "corner-mart") {
  const { organization } = await createOrganization(admin, { name: "Corner Mart Group", slug });
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
const pull = (token: string) => call(accessSync, request("GET", "/", { headers: { Authorization: `Bearer ${token}` } }));

describe("a store and its licence", () => {
  it("each store has its own license or none; issue, edit, and one per store", async () => {
    const organizationId = await newOrg();
    const five = await newStore(organizationId, "Store 5", { storeLicense: { plan: "standard", entitlementDays: 365 } });
    expect(five.status).toBe(201);
    expect(five.body.store.license).toMatchObject({ scope: "store", plan: "standard", status: "active" });
    expect(five.body.store.license.licenseNumber).toMatch(LICENSE_NUMBER);
    expect(five.body.store.license.licenseNumber.startsWith("SD-STR-")).toBe(true);
    const six = await newStore(organizationId, "Store 6");
    expect(six.body.store).toMatchObject({ licenseId: null, license: null });

    const issued = await storeLicense(organizationId, six.body.store.storeId, { plan: "trial", entitlementDays: 30 });
    expect(issued.status).toBe(200);
    expect(issued.body).toMatchObject({ created: true, license: { scope: "store", status: "trialing" } });
    const edited = await storeLicense(organizationId, six.body.store.storeId, { renewDays: 30, maxPcsPerStore: 2 });
    expect(edited.body).toMatchObject({ created: false, license: { maxPcsPerStore: 2 } });
    expect(await lastAudit("license.renew")).toBeTruthy();

    const again = await call(createLicenseRoute, as("POST", { storeId: six.body.store.storeId, plan: "trial" }), { organizationId });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("LICENSE_EXISTS");
    const noMaster = await call(createLicenseRoute, as("POST", { scope: "organization", plan: "trial" }), { organizationId });
    expect(noMaster.status).toBe(400);
    expect(noMaster.body.error.code).toBe("REQUEST_INVALID");
  });

  it("an Unlicensed store gets no key and no activation, and its access pull is refused", async () => {
    const organizationId = await newOrg();
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
    const organizationId = await newOrg();
    const a = (await newStore(organizationId, "A", { storeLicense: { plan: "standard" } })).body.store;
    const b = (await newStore(organizationId, "B", { storeLicense: { plan: "standard" } })).body.store;
    const pcB = await activatePc(organizationId, b.storeId);
    vi.mocked(scheduleNotify).mockClear();
    await patch(organizationId, a.license.licenseId, { status: "suspended" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeIds: [a.storeId], reason: "license.change" });
    expect((await pull(pcB.token)).body.subscription.status).toBe("active");
  });

  it("the dashboard and the license list read each store's own license", async () => {
    const organizationId = await newOrg();
    const ending = (await newStore(organizationId, "Main St", { storeLicense: { plan: "standard", entitlementDays: 10 } })).body.store;
    const bare = (await newStore(organizationId, "Bay Rd")).body.store;
    await activatePc(organizationId, ending.storeId);

    // One PC per store, and the limit comes from that store's own license.
    const second = await call(issueKeyRoute, as("POST", { deliver: "show" }), { organizationId, storeId: ending.storeId });
    expect(second.status).toBe(409);
    expect(second.body.error.message).toContain("its license allows 1");

    const dash = await call(dashboardRoute, as("GET"));
    expect(dash.body.counts.unlicensedStores).toBe(1);
    expect(dash.body.counts.licensesEndingSoon).toBe(1);
    expect(dash.body.attention).toContainEqual(expect.objectContaining({ kind: "store_unlicensed", storeId: bare.storeId }));
    expect(dash.body.attention).toContainEqual(
      expect.objectContaining({ kind: "license_ending", licenseId: ending.license.licenseId, licenseNumber: ending.license.licenseNumber })
    );

    // The list names the one store each license covers, and reports a lapsed one as expired.
    const before = await list(organizationId);
    expect(before.body.licenses).toHaveLength(1);
    expect(before.body.licenses[0]).toMatchObject({
      storeId: ending.storeId,
      coveredStores: [{ storeId: ending.storeId, name: ending.name }]
    });
    await LicenseModel.updateOne({ licenseId: ending.license.licenseId }, { $set: { entitlementExpiresAt: new Date(Date.now() - DAY) } });
    expect((await list(organizationId)).body.licenses[0].status).toBe("expired");

    // Coverage stays with its own store: the unlicensed one gains nothing from its neighbour.
    expect((await coveringLicense({ organizationId, storeId: ending.storeId }))?.storeId).toBe(ending.storeId);
    expect(await coveringLicense({ organizationId, storeId: bare.storeId })).toBeNull();
  });

  it("copies a live master license into one per store, so no live store goes Unlicensed", async () => {
    const organizationId = await newOrg();
    const one = (await newStore(organizationId, "Hop In 4630")).body.store;
    const two = (await newStore(organizationId, "Bay Rd")).body.store;

    // The shape the production database actually held on 2026-09-23: scope "organization",
    // keyed by the organization, trialing, with an end date in the future.
    // Whole seconds: the stored date carries no milliseconds.
    const ends = new Date(Math.floor((Date.now() + 23 * DAY) / 1000) * 1000);
    await LicenseModel.create({
      licenseId: "lic_master",
      licenseNumber: "SD-ORG-D7QD2X",
      organizationId,
      scope: "organization",
      plan: "standard",
      status: "trialing",
      startsAt: new Date(Date.now() - DAY),
      entitlementExpiresAt: ends,
      offlineGraceDays: 7,
      maxPcsPerStore: 2,
      coverageKey: `org:${organizationId}`
    });

    // Before: the master matches no store key, so both stores are Unlicensed.
    expect(await coveringLicense({ organizationId, storeId: one.storeId })).toBeNull();
    expect(await coveringLicense({ organizationId, storeId: two.storeId })).toBeNull();

    expect(await migrateStoreScopedLicenses()).toEqual({ issued: 2, masters: 1, alreadyCovered: 0 });

    for (const store of [one, two]) {
      const covering = await coveringLicense({ organizationId, storeId: store.storeId });
      expect(covering).toMatchObject({
        scope: "store",
        storeId: store.storeId,
        plan: "standard",
        status: "trialing",
        offlineGraceDays: 7,
        maxPcsPerStore: 2
      });
      expect(String(covering!.licenseNumber)).toMatch(/^SD-STR-/);
      expect(new Date(String(covering!.entitlementExpiresAt)).toISOString()).toBe(ends.toISOString());
      expect(String(covering!.notes)).toContain("SD-ORG-D7QD2X");
    }

    // The master row stays as the record of what the store held; it simply covers nothing now.
    const master = await LicenseModel.findOne({ licenseId: "lic_master" }).lean();
    expect(master).toMatchObject({ scope: "organization", status: "trialing" });

    // Idempotent: a second instance issues nothing and says both stores are already covered.
    expect(await migrateStoreScopedLicenses()).toEqual({ issued: 0, masters: 1, alreadyCovered: 2 });
  });

  it("leaves a store that already has its own license, and a cancelled master, alone", async () => {
    const organizationId = await newOrg();
    const own = (await newStore(organizationId, "Has its own", { storeLicense: { plan: "trial", entitlementDays: 30 } })).body.store;
    await LicenseModel.create({
      licenseId: "lic_dead",
      licenseNumber: "SD-ORG-CANCEL",
      organizationId,
      scope: "organization",
      plan: "standard",
      status: "cancelled",
      startsAt: new Date(Date.now() - DAY),
      entitlementExpiresAt: new Date(Date.now() + DAY)
    });

    // A cancelled master is not a live license, so there is nothing to copy from it.
    expect(await migrateStoreScopedLicenses()).toEqual({ issued: 0, masters: 0, alreadyCovered: 0 });
    expect((await coveringLicense({ organizationId, storeId: own.storeId }))?.licenseNumber).toBe(own.license.licenseNumber);
  });

  it("organization create: no mode, no license, and the old master fields change nothing", async () => {
    const post = (body: unknown) => call(createOrgRoute, as("POST", body));
    const plain = await post({ name: "A", slug: "a-org" });
    expect(plain.status).toBe(201);
    expect(plain.body.organization).not.toHaveProperty("licensingMode");
    expect(plain.body.license).toBeNull();
    for (const [slug, body] of [
      ["b-org", { licensingMode: "master" }],
      ["c-org", { license: { plan: "trial" } }],
      ["d-org", { licensingMode: "storeWise", license: { plan: "trial", maxStores: 5 } }]
    ] as const) {
      const res = await post({ name: slug.toUpperCase(), slug, ...body });
      expect(res.status).toBe(201);
      expect(res.body.license).toBeNull();
      expect(await LicenseModel.countDocuments({ organizationId: res.body.organization.organizationId })).toBe(0);
    }
  });

  it.each([
    ["a license without its store", { plan: "trial" }],
    ["a scope, which no longer exists", { scope: "organization", storeId: "store_x", plan: "trial" }],
    ["31 days of grace", { storeId: "store_x", plan: "trial", offlineGraceDays: 31 }],
    ["seats", { storeId: "store_x", plan: "trial", maxStores: 2 }]
  ])("answers 400 for %s", async (_label, body) => {
    const organizationId = await newOrg();
    expect((await call(createLicenseRoute, as("POST", body), { organizationId })).status).toBe(400);
  });
});

