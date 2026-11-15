import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, request, seedOrganization } from "./helpers/api";
import { TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";
import { getStoreSetup } from "@/lib/setup";
import { storeReach } from "@/lib/store-reach";
import { listStores } from "@/lib/tenant-stores";
import { POST as issueSetupKey } from "@/app/api/v1/admin/stores/[storeId]/setup-keys/route";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cloudflare")>()),
  provisionTunnel: vi.fn(async () => ({ tunnelUrl: null, tunnelToken: null, tunnelName: null }))
}));

setupMemoryMongo();

let admin: Awaited<ReturnType<typeof createAdmin>>;
let organizationId: string;
let storeId: string;

/** A lottery PC of the same store: a separate product, sharing the collection and nothing else. */
async function addLotteryPc(status = "active") {
  const workerInstallationId = publicId("winst");
  await WorkerInstallationModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    product: "lottery",
    workerName: "Counter PC",
    contactEmail: "store42@example.invalid",
    status,
    activatedAt: new Date()
  });
  return workerInstallationId;
}

/** What the phone's store list says about setup (lib/store-reach.ts, shared with the email sign-in). */
async function phoneSetup() {
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Record<string, unknown>;
  return (await storeReach([store])).get(storeId)?.setup;
}

beforeEach(async () => {
  admin = await createAdmin();
  const seeded = await seedOrganization(admin, { maxPcsPerStore: 1 });
  organizationId = seeded.organization.organizationId;
  storeId = seeded.store.storeId;
});

describe("a lottery PC is not a StoreDesk PC", () => {
  it("leaves the store's setup status alone", async () => {
    await addLotteryPc();
    const setup = await getStoreSetup(storeId);
    expect(setup.installations).toHaveLength(0);
    expect(setup.installation).toBeNull();
  });

  it("does not make the store look set up in the phone's store list", async () => {
    await addLotteryPc();
    expect(await phoneSetup()).toBe("none");
  });

  it("does not become the store's current PC in the admin list", async () => {
    await addLotteryPc();
    const stores = await listStores(organizationId);
    expect(stores[0]?.installation ?? null).toBeNull();
  });

  it("does not consume the licence's PC allowance", async () => {
    // One PC per store, and the store's one lottery PC must not be the one.
    await addLotteryPc();
    const res = await call(
      issueSetupKey,
      request("POST", "/", { token: admin.token, body: { contactEmail: "store42@example.invalid" } }),
      { organizationId, storeId }
    );
    expect(res.status).toBe(201);
  });

  it("still lets the StoreDesk PC be the one that counts", async () => {
    await addLotteryPc();
    await activatePc(organizationId, storeId);
    const setup = await getStoreSetup(storeId);
    expect(setup.installations).toHaveLength(1);
    expect(await phoneSetup()).toBe("active");
  });

  it("is unaffected by the StoreDesk PC in turn", async () => {
    const lotteryId = await addLotteryPc();
    await activatePc(organizationId, storeId);
    const mine = await WorkerInstallationModel.findOne({ workerInstallationId: lotteryId }).lean();
    expect(mine?.status).toBe("active");
    expect(mine?.product).toBe("lottery");
  });
});

describe("installations written before the lottery app existed", () => {
  it("count as StoreDesk, so nothing that used to work stops", async () => {
    const { workerInstallationId } = await activatePc(organizationId, storeId);
    // The helper writes no `product`, exactly like a row created by an older build.
    const row = await WorkerInstallationModel.findOne({ workerInstallationId }).lean();
    expect(row?.product).toBe("storedesk");

    await WorkerInstallationModel.updateOne({ workerInstallationId }, { $unset: { product: 1 } });
    const setup = await getStoreSetup(storeId);
    expect(setup.installations).toHaveLength(1);
    expect(await phoneSetup()).toBe("active");
  });
});

describe("a credential proves a store and a product", () => {
  /**
   * `authenticateWorker` checks the product, so a lottery installation's credential (any issued
   * before D-26 retired them) can never open a StoreDesk edge route such as
   * `GET /api/v1/edge/sync/config`, which hands back the store's tunnel token.
   */
  it("refuses a lottery credential on a StoreDesk route", async () => {
    const pc = await activatePc(organizationId, storeId);
    await WorkerInstallationModel.updateOne({ workerInstallationId: pc.workerInstallationId }, { product: "lottery" });
    const { GET: syncConfig } = await import("@/app/api/v1/edge/sync/config/route");
    const res = await call(syncConfig, request("GET", "/", { token: pc.token }), {});
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain("WRONG_PRODUCT");
    expect(JSON.stringify(res.body)).not.toContain("posPassword");
  });

  it("still lets the StoreDesk PC use its own routes, including one with no product field", async () => {
    // A document written before the field existed has no such key at all, and Mongo does not
    // backfill one. So take it away and test THAT.
    const pc = await activatePc(organizationId, storeId);
    await WorkerInstallationModel.updateOne({ workerInstallationId: pc.workerInstallationId }, { $unset: { product: 1 } });
    const { GET: syncConfig } = await import("@/app/api/v1/edge/sync/config/route");
    const res = await call(syncConfig, request("GET", "/", { token: pc.token }), {});
    expect(res.status).toBe(200);
  });
});
