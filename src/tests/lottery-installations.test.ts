import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, request, seedOrganization } from "./helpers/api";
import { WorkerInstallationModel } from "@/models/ControlPlane";
import { publicId } from "@/lib/control-plane-security";
import { getStoreSetup } from "@/lib/setup";
import { lookupOrganization } from "@/lib/control-plane";
import { listStores, updateStoreSettings } from "@/lib/tenant-stores";
import { POST as issueSetupKey } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";

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

beforeEach(async () => {
  admin = await createAdmin();
  const seeded = await seedOrganization(admin, { maxPcsPerStore: 1 });
  organizationId = seeded.organization.organizationId;
  storeId = seeded.store.storeId;
});

describe("a lottery PC is not a StoreDesk PC", () => {
  it("leaves the store's setup status alone", async () => {
    await addLotteryPc();
    const setup = await getStoreSetup(organizationId, storeId);
    expect(setup.installations).toHaveLength(0);
    expect(setup.installation).toBeNull();
  });

  it("does not make the store look set up to the phone's org lookup", async () => {
    await addLotteryPc();
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.setup).toBe("none");
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
    const setup = await getStoreSetup(organizationId, storeId);
    expect(setup.installations).toHaveLength(1);
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.setup).toBe("active");
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
    const setup = await getStoreSetup(organizationId, storeId);
    expect(setup.installations).toHaveLength(1);
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.setup).toBe("active");
  });
});

describe("the org-tag lookup tells the lottery app what it needs", () => {
  it("says a store sells lottery, is switched on for the app, and is licensed", async () => {
    await updateStoreSettings(
      admin,
      organizationId,
      storeId,
      { capabilities: { lottery: true, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null } },
      1
    );
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.lottery).toEqual({ hasLottery: true, appEnabled: true, pc: null });
    expect(lookup.stores[0]?.licence).toEqual({ covered: true, status: "active" });
  });

  it("answers that the app is on the moment the store sells lottery — one switch, not two", async () => {
    await updateStoreSettings(
      admin,
      organizationId,
      storeId,
      { capabilities: { lottery: true, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null } },
      1
    );
    const lookup = await lookupOrganization("example-retail");
    // D-24: there is no second opt-in. Selling lottery is running StoreDesk Lottery.
    expect(lookup.stores[0]?.lottery).toMatchObject({ hasLottery: true, appEnabled: true });
  });

  it("reports the PC that already holds the store, by date and never by name", async () => {
    await addLotteryPc();
    const lookup = await lookupOrganization("example-retail");
    const pc = lookup.stores[0]?.lottery.pc;
    expect(pc?.claimedAt).toEqual(expect.any(String));
    expect(JSON.stringify(lookup)).not.toContain("Counter PC");
  });

  it("ignores a lottery PC that is no longer live", async () => {
    await addLotteryPc("awaiting_activation");
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.lottery.pc).toBeNull();
  });

  it("never leaks a licence number, only whether one covers the store and its status", async () => {
    const lookup = await lookupOrganization("example-retail");
    expect(lookup.stores[0]?.licence.covered).toBe(true);
    expect(JSON.stringify(lookup)).not.toMatch(/SD-(ORG|STR)-/);
  });
});
