import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as dashboard } from "@/app/api/v1/admin/dashboard/route";
import { GET as audit } from "@/app/api/v1/admin/organizations/[organizationId]/audit/route";
import { issueStoreSetupKey } from "@/lib/setup";
import { writeAudit } from "@/lib/audit";
import { SubscriptionModel, TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/** The dashboard's counts and needs-attention list, and the per-organization Activity (P14). */

setupMemoryMongo();

const DAY = 86_400_000;
let admin: TestAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
});
afterEach(() => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

describe("GET /api/v1/admin/dashboard", () => {
  it("counts, lists what needs attention, and shows recent activity by admin e-mail", async () => {
    const { organization, subscription, store } = await seedOrganization(admin);
    await issueStoreSetupKey(admin, organization.organizationId, store.storeId, { deliver: "show" });
    await SubscriptionModel.updateOne(
      { subscriptionId: subscription.subscriptionId },
      { $set: { entitlementExpiresAt: new Date(Date.now() + 10 * DAY) } }
    );
    const res = await call(dashboard, request("GET", "/", { token: admin.token }));
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ organizations: 1, stores: 1, pcsOnline: 0, pcsTotal: 0, subscriptionsEndingSoon: 1 });
    const kinds = res.body.attention.map((item: { kind: string }) => item.kind);
    expect(kinds).toContain("pc_not_activated");
    expect(kinds).toContain("subscription_ending");
    expect(res.body.attention.find((item: { kind: string }) => item.kind === "pc_not_activated")).toMatchObject({
      organizationName: "Example Retail",
      storeName: "Store 42",
      message: expect.stringContaining("key issued")
    });
    expect(res.body.recentActivity[0]).toMatchObject({ actorLabel: admin.email, organizationName: "Example Retail" });
    expect((await call(dashboard, request("GET", "/"))).status).toBe(401);
  });

  it("counts PCs online and flags a PC not seen for a day and a failed tunnel", async () => {
    const { organization, subscription, store } = await seedOrganization(admin, { maxWorkerInstallations: 2 });
    const online = await activatePc(organization.organizationId, store.storeId, subscription.subscriptionId);
    const quiet = await activatePc(organization.organizationId, store.storeId, subscription.subscriptionId);
    await WorkerInstallationModel.updateOne({ workerInstallationId: online.workerInstallationId }, { $set: { lastSeenAt: new Date() } });
    await WorkerInstallationModel.updateOne({ workerInstallationId: quiet.workerInstallationId }, { $set: { lastSeenAt: new Date(Date.now() - 2 * DAY) } });
    process.env.CLOUDFLARE_API_TOKEN = "cf";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    await TenantStoreModel.updateOne({ storeId: store.storeId }, { $set: { tunnelStatus: "failed", tunnelError: "quota" } });

    const res = await call(dashboard, request("GET", "/", { token: admin.token }));
    expect(res.body.counts).toMatchObject({ pcsOnline: 1, pcsTotal: 2 });
    const offline = res.body.attention.filter((item: { kind: string }) => item.kind === "store_offline");
    expect(offline).toHaveLength(1);
    expect(offline[0].message).toContain("2 d ago");
    expect(res.body.attention.find((item: { kind: string }) => item.kind === "tunnel_failed").message).toContain("quota");
  });
});

describe("GET /api/v1/admin/organizations/{org}/audit", () => {
  it("pages newest first, filters by action, and leaves store pulls out", async () => {
    const { organization } = await seedOrganization(admin);
    const organizationId = organization.organizationId;
    await writeAudit({ organizationId, actorType: "worker", actorId: "winst_1", action: "edge.access_sync", targetType: "worker_installation", targetId: "winst_1" });
    const params = { organizationId };

    const first = await call(audit, request("GET", `/?limit=2`, { token: admin.token }), params);
    expect(first.status).toBe(200);
    expect(first.body.events).toHaveLength(2);
    expect(first.body.events[0].action).toBe("store.tunnel.provision");
    expect(first.body.events[0]).toMatchObject({ actorLabel: admin.email, storeName: "Store 42", targetLabel: "Store 42" });
    expect(first.body.nextCursor).toBeTruthy();
    expect(first.body.actions).toEqual(expect.arrayContaining(["organization.create", "store.create", "edge.access_sync"]));

    const rest = await call(audit, request("GET", `/?limit=50&cursor=${first.body.nextCursor}`, { token: admin.token }), params);
    const all = [...first.body.events, ...rest.body.events].map((event: { action: string }) => event.action);
    expect(all).toEqual(["store.tunnel.provision", "store.create", "subscription.create", "organization.create"]);
    expect(rest.body.nextCursor).toBeNull();

    const pulls = await call(audit, request("GET", `/?action=edge.access_sync`, { token: admin.token }), params);
    expect(pulls.body.events.map((event: { action: string }) => event.action)).toEqual(["edge.access_sync"]);
    expect(pulls.body.events[0].actorLabel).toBe("Store PC");
  });

  it("answers 400 for a bad cursor, 404 for an unknown organization and 401 without a session", async () => {
    const { organization } = await seedOrganization(admin);
    expect((await call(audit, request("GET", "/?cursor=nope", { token: admin.token }), { organizationId: organization.organizationId })).status).toBe(400);
    expect((await call(audit, request("GET", "/", { token: admin.token }), { organizationId: "org_nope" })).status).toBe(404);
    expect((await call(audit, request("GET", "/"), { organizationId: organization.organizationId })).status).toBe(401);
  });
});
