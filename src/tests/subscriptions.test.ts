import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as list, POST as create } from "@/app/api/v1/admin/organizations/[organizationId]/subscriptions/route";
import { PATCH as patch } from "@/app/api/v1/admin/organizations/[organizationId]/subscriptions/[subscriptionId]/route";
import { createOrganization } from "@/lib/organizations";
import { createStore } from "@/lib/tenant-stores";
import { scheduleNotify } from "@/lib/store-notify";
import { SubscriptionModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/** Subscriptions (P11): create, edit, renew, suspend, cancel — audited and pushed to the stores. */

setupMemoryMongo();

const DAY = 86_400_000;
let admin: TestAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
});

function patchSub(organizationId: string, subscriptionId: string, body: unknown) {
  return call(patch, request("PATCH", "/", { token: admin.token, body }), { organizationId, subscriptionId });
}

describe("POST and GET …/subscriptions", () => {
  it("creates a subscription with the default limits, audits and notifies", async () => {
    const { organization } = await createOrganization(admin, { name: "A", slug: "a-org" });
    const params = { organizationId: organization.organizationId };
    const res = await call(create, request("POST", "/", { token: admin.token, body: { plan: "standard" } }), params);
    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({
      plan: "standard",
      status: "active",
      maxStores: 5,
      maxWorkerInstallations: 5,
      offlineGraceDays: 7,
      storeCount: 0
    });
    expect(res.body.subscription.daysRemaining).toBe(365);
    expect(await lastAudit("subscription.create")).toMatchObject({ actorId: admin.adminId });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId: organization.organizationId, reason: "subscription.create" });
  });

  it.each([
    ["an unknown plan", { plan: "gold" }],
    ["both a length and an end date", { plan: "trial", entitlementDays: 10, entitlementExpiresAt: "2031-01-01T00:00:00Z" }],
    ["31 grace days", { plan: "standard", offlineGraceDays: 31 }],
    ["0 stores", { plan: "standard", maxStores: 0 }],
    ["a date that is not one", { plan: "custom", entitlementExpiresAt: "someday" }]
  ])("answers 400 for %s", async (_label, body) => {
    const { organization } = await createOrganization(admin, { name: "A", slug: "a-org" });
    const res = await call(create, request("POST", "/", { token: admin.token, body }), { organizationId: organization.organizationId });
    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown organization and 401 without a session", async () => {
    expect((await call(create, request("POST", "/", { token: admin.token, body: { plan: "trial" } }), { organizationId: "org_nope" })).status).toBe(404);
    expect((await call(list, request("GET", "/"), { organizationId: "org_nope" })).status).toBe(401);
  });

  it("lists with the store count, and marks a lapsed subscription expired on read", async () => {
    const { organization, subscription } = await seedOrganization(admin);
    await SubscriptionModel.updateOne(
      { subscriptionId: subscription.subscriptionId },
      { $set: { entitlementExpiresAt: new Date(Date.now() - DAY) } }
    );
    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId: organization.organizationId });
    expect(res.status).toBe(200);
    expect(res.body.subscriptions[0]).toMatchObject({ status: "expired", storeCount: 1 });
    expect((await SubscriptionModel.findOne({ subscriptionId: subscription.subscriptionId }).lean())?.status).toBe("expired");
  });
});

describe("PATCH …/subscriptions/{sub}", () => {
  it("renews a lapsed subscription back to active, audits subscription.renew and notifies its stores", async () => {
    const { organization, subscription, store } = await seedOrganization(admin);
    await SubscriptionModel.updateOne(
      { subscriptionId: subscription.subscriptionId },
      { $set: { status: "expired", entitlementExpiresAt: new Date(Date.now() - DAY) } }
    );
    const res = await patchSub(organization.organizationId, subscription.subscriptionId, { renewDays: 30 });
    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe("active");
    expect(res.body.subscription.daysRemaining).toBe(30);
    expect(await lastAudit("subscription.renew")).toBeTruthy();
    expect(scheduleNotify).toHaveBeenCalledWith({
      organizationId: organization.organizationId,
      storeIds: [store.storeId],
      reason: "subscription.change"
    });
  });

  it("renews from the current end date while it is still ahead", async () => {
    const { organization, subscription } = await seedOrganization(admin);
    await SubscriptionModel.updateOne(
      { subscriptionId: subscription.subscriptionId },
      { $set: { entitlementExpiresAt: new Date(Date.now() + 10 * DAY) } }
    );
    const res = await patchSub(organization.organizationId, subscription.subscriptionId, { renewDays: 30 });
    expect(res.body.subscription.daysRemaining).toBe(40);
  });

  it("suspends and cancels, each with its own audit action", async () => {
    const { organization, subscription } = await seedOrganization(admin);
    expect((await patchSub(organization.organizationId, subscription.subscriptionId, { status: "suspended" })).body.subscription.status).toBe("suspended");
    expect(await lastAudit("subscription.suspend")).toBeTruthy();
    expect((await patchSub(organization.organizationId, subscription.subscriptionId, { status: "cancelled" })).body.subscription.status).toBe("cancelled");
    expect(await lastAudit("subscription.cancel")).toBeTruthy();
    const edit = await patchSub(organization.organizationId, subscription.subscriptionId, { plan: "custom", offlineGraceDays: 14 });
    expect(edit.body.subscription).toMatchObject({ plan: "custom", offlineGraceDays: 14 });
    expect(await lastAudit("subscription.update")).toBeTruthy();
  });

  it("answers 409 LIMIT_BELOW_USAGE when a limit would go below what is in use", async () => {
    const { organization, subscription } = await seedOrganization(admin, { maxWorkerInstallations: 2 });
    await createStore(admin, organization.organizationId, { name: "Store 17" });
    const stores = await patchSub(organization.organizationId, subscription.subscriptionId, { maxStores: 1 });
    expect(stores.status).toBe(409);
    expect(stores.body.error.code).toBe("LIMIT_BELOW_USAGE");

    const { organization: org2, subscription: sub2, store } = await seedOrganization(admin, { slug: "two-pcs", maxWorkerInstallations: 2 });
    await activatePc(org2.organizationId, store.storeId, sub2.subscriptionId);
    await activatePc(org2.organizationId, store.storeId, sub2.subscriptionId);
    const pcs = await patchSub(org2.organizationId, sub2.subscriptionId, { maxWorkerInstallations: 1 });
    expect(pcs.status).toBe(409);
  });

  it("answers 400 ENTITLEMENT_ENDED for an active status with a past end date", async () => {
    const { organization, subscription } = await seedOrganization(admin);
    const res = await patchSub(organization.organizationId, subscription.subscriptionId, {
      status: "active",
      entitlementExpiresAt: new Date(Date.now() - DAY).toISOString()
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ENTITLEMENT_ENDED");
  });

  it("answers 400 for an empty or unknown change and 404 for an unknown subscription", async () => {
    const { organization, subscription } = await seedOrganization(admin);
    expect((await patchSub(organization.organizationId, subscription.subscriptionId, {})).status).toBe(400);
    expect((await patchSub(organization.organizationId, subscription.subscriptionId, { maxDevices: 3 })).status).toBe(400);
    expect((await patchSub(organization.organizationId, subscription.subscriptionId, { renewDays: 30, entitlementExpiresAt: "2031-01-01T00:00:00Z" })).status).toBe(400);
    expect((await patchSub(organization.organizationId, "sub_nope", { renewDays: 30 })).status).toBe(404);
  });
});
