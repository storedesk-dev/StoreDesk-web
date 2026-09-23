import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization } from "./helpers/api";
import { LicenseModel, SetupKeyModel, WorkerCredentialModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { getStoreSettings, updateStoreSettings } from "@/lib/tenant-stores";
import {
  GET as getLotteryPc,
  POST as issueLotteryKey
} from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/lottery/setup-keys/route";
import { POST as claim } from "@/app/api/v1/lottery/setup-keys/redeem/route";
import { POST as vouchedClaim } from "@/app/api/v1/edge/lottery/claim/route";
import { POST as issueStoreDeskKey } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";

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
let params: { organizationId: string; storeId: string };

/** The store as it has to be before a lottery PC may be set up: it sells lottery, and it is switched on. */
async function enableLottery(appEnabled = true) {
  const current = await getStoreSettings(params.organizationId, params.storeId);
  await updateStoreSettings(
    admin,
    params.organizationId,
    params.storeId,
    {
      capabilities: { lottery: true, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null },
      lottery: { appEnabled }
    },
    current.settingsVersion
  );
}

const issue = () => call(issueLotteryKey, request("POST", "/", { token: admin.token, body: {} }), params);

const redeem = (setupKey: string, deviceName = "COUNTER-PC") =>
  call(claim, request("POST", "/", { body: { setupKey, deviceName } }), {});

beforeEach(async () => {
  admin = await createAdmin();
  const seeded = await seedOrganization(admin, { maxPcsPerStore: 1 });
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});

describe("issuing a lottery setup key", () => {
  it("refuses a store that does not sell lottery", async () => {
    const res = await issue();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STORE_NO_LOTTERY");
  });

  it("refuses a store that sells lottery but is not switched on for the app", async () => {
    await enableLottery(false);
    const res = await issue();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LOTTERY_APP_DISABLED");
  });

  it("refuses a store whose licence is not in force", async () => {
    await enableLottery();
    await LicenseModel.updateMany({ organizationId: params.organizationId }, { $set: { status: "suspended" } });
    const res = await issue();
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("LICENSE_INACTIVE");
  });

  it("issues the key once, creates the lottery installation, and audits it", async () => {
    await enableLottery();
    const res = await issue();
    expect(res.status).toBe(201);
    expect(res.body.setupKey).toMatch(/^set_[a-f0-9]{32}\./);
    const installation = await WorkerInstallationModel.findOne({ storeId: params.storeId, product: "lottery" }).lean();
    expect(installation?.status).toBe("awaiting_activation");
    expect(await lastAudit("lottery.setup_key.issue")).toMatchObject({ storeId: params.storeId });
  });

  it("reuses the store's one lottery installation on a second key", async () => {
    await enableLottery();
    const first = await issue();
    const second = await issue();
    expect(second.body.workerInstallationId).toBe(first.body.workerInstallationId);
    expect(await WorkerInstallationModel.countDocuments({ storeId: params.storeId, product: "lottery" })).toBe(1);
  });
});

describe("claiming a PC with the key", () => {
  it("hands back a credential and the store, and never a tunnel token or a relay key", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    const res = await redeem(key);
    expect(res.status).toBe(201);
    expect(res.body.workerCredential).toMatch(/^wcred_[a-f0-9]{32}\./);
    expect(res.body.store.name).toBe("Store 42");
    expect(res.body.licence.status).toBe("active");
    expect(res.body.replacedPc).toBe(false);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("relayKey");
    expect(text).not.toContain("cloudflareToken");
    expect(text).not.toContain("tunnelUrl");
    expect(text).not.toContain("configJson");
  });

  it("stores the credential hashed, never in the clear", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    const res = await redeem(key);
    const secret = String(res.body.workerCredential).split(".")[1];
    const row = await WorkerCredentialModel.findOne({ credentialId: res.body.workerCredentialId })
      .select("+secretHash")
      .lean();
    expect(row?.secretHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it("names the PC and marks the installation active", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    await redeem(key, "BACK-OFFICE-PC");
    const installation = await WorkerInstallationModel.findOne({ storeId: params.storeId, product: "lottery" }).lean();
    expect(installation).toMatchObject({ status: "active", workerName: "BACK-OFFICE-PC" });
    const view = await call(getLotteryPc, request("GET", "/", { token: admin.token }), params);
    expect(view.body.installation).toMatchObject({ status: "active", deviceName: "BACK-OFFICE-PC" });
  });

  it("moves the setup to a second PC and stops the first one working", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    const first = await redeem(key, "OLD-PC");
    const second = await redeem(key, "NEW-PC");

    expect(second.body.replacedPc).toBe(true);
    const old = await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean();
    expect(old?.status).toBe("revoked");
    const now = await WorkerCredentialModel.findOne({ credentialId: second.body.workerCredentialId }).lean();
    expect(now?.status).toBe("active");
    expect(await lastAudit("lottery.installation.move")).toMatchObject({ metadata: { deviceName: "NEW-PC" } });
  });

  it("refuses a made-up key", async () => {
    const res = await redeem(`set_${"a".repeat(32)}.${"b".repeat(40)}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SETUP_KEY_INVALID");
  });

  it("refuses a StoreDesk key, so a lottery PC can never be handed a store's tunnel", async () => {
    await enableLottery();
    const storeDeskKey = await call(
      issueStoreDeskKey,
      request("POST", "/", { token: admin.token, body: { deliver: "show" } }),
      params
    );
    expect(storeDeskKey.status).toBe(201);
    const res = await redeem(String(storeDeskKey.body.setupKey));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("WRONG_PRODUCT");
  });

  it("re-checks the store at claim, not only when the key was issued", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    await enableLottery(false); // the switch goes off after the key was handed over
    const res = await redeem(key);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LOTTERY_APP_DISABLED");
  });

  it("leaves no usable key behind when the installation is gone", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    await WorkerInstallationModel.deleteMany({ storeId: params.storeId, product: "lottery" });
    const res = await redeem(key);
    expect(res.status).toBe(404);
  });

  it("keeps the key usable for the move, and counts the redeems", async () => {
    await enableLottery();
    const key = (await issue()).body.setupKey as string;
    await redeem(key, "ONE");
    await redeem(key, "TWO");
    const row = await SetupKeyModel.findOne({ storeId: params.storeId }).lean();
    expect(row?.redeemCount).toBe(2);
  });
});

describe("a store that already runs StoreDesk types nothing", () => {
  it("claims the lottery PC on its own service's word, with no setup key", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(
      vouchedClaim,
      request("POST", "/", { token: pc.token, body: { deviceName: "COUNTER-PC" } }),
      {}
    );
    expect(res.status).toBe(201);
    expect(res.body.workerCredential).toMatch(/^wcred_[a-f0-9]{32}\./);
    expect(res.body.storeId).toBe(params.storeId);
    expect(res.body.replacedPc).toBe(false);
    expect(await SetupKeyModel.countDocuments({ storeId: params.storeId })).toBe(0);
  });

  it("gives the lottery PC its own installation, separate from the StoreDesk one", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "COUNTER-PC" } }), {});
    expect(res.body.workerInstallationId).not.toBe(pc.workerInstallationId);
    const lottery = await WorkerInstallationModel.findOne({ storeId: params.storeId, product: "lottery" }).lean();
    expect(lottery).toMatchObject({ status: "active", workerName: "COUNTER-PC" });
    const storedesk = await WorkerInstallationModel.findOne({ workerInstallationId: pc.workerInstallationId }).lean();
    expect(storedesk?.status).toBe("active");
  });

  it("never hands the lottery PC a tunnel token or a relay key either", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "COUNTER-PC" } }), {});
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("relayKey");
    expect(text).not.toContain("cloudflareToken");
    expect(text).not.toContain("tunnelUrl");
  });

  it("still refuses a store that is not switched on for the app", async () => {
    await enableLottery(false);
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "COUNTER-PC" } }), {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LOTTERY_APP_DISABLED");
  });

  it("refuses anyone without the store's credential", async () => {
    await enableLottery();
    const res = await call(vouchedClaim, request("POST", "/", { body: { deviceName: "COUNTER-PC" } }), {});
    expect(res.status).toBe(401);
  });

  it("moves the setup when a second PC is vouched for", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const first = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "OLD-PC" } }), {});
    const second = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "NEW-PC" } }), {});
    expect(second.body.replacedPc).toBe(true);
    const old = await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean();
    expect(old?.status).toBe("revoked");
    expect(await lastAudit("lottery.installation.move")).toMatchObject({ metadata: { via: "storedesk_service" } });
  });
});

describe("the body the StoreDesk Service actually posts", () => {
  /**
   * The test above hand-wrote `{ deviceName }`. The service sends three keys — and against a
   * `.strict()` schema that accepted two, the one screen that is supposed to need nothing typed
   * answered `appVersion: Invalid input: expected string, received null`. A test that writes its
   * own request cannot catch that, so this one is the service's body verbatim.
   *
   * LotteryClaimService.cs: { deviceName, appVersion, product: "lottery" }, with appVersion null
   * when StoreDesk Desktop did not supply one.
   */
  const serviceBody = (appVersion: string | null) => ({
    deviceName: "COUNTER-PC",
    appVersion,
    product: "lottery" as const
  });

  it("accepts it with no version, which is what the desktop sends today", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: serviceBody(null) }), {});
    expect(res.status).toBe(201);
    expect(res.body.workerCredential).toMatch(/^wcred_[a-f0-9]{32}\./);
  });

  it("accepts it with a version", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: serviceBody("1.4.0") }), {});
    expect(res.status).toBe(201);
    const installation = await WorkerInstallationModel.findOne({
      workerInstallationId: res.body.workerInstallationId
    }).lean();
    expect(installation?.workerVersion).toBe("1.4.0");
  });

  it("still refuses a key it does not know, so the schema stayed strict", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const res = await call(
      vouchedClaim,
      request("POST", "/", { token: pc.token, body: { ...serviceBody(null), tunnelToken: "nice try" } }),
      {}
    );
    expect(res.status).toBe(400);
  });
});

describe("a credential proves a store and a product", () => {
  /**
   * `authenticateWorker` had no product check, so a lottery PC's credential opened every StoreDesk
   * edge route — including `GET /api/v1/edge/sync/config`, which hands back the store's Cloudflare
   * tunnel token and its Verifone Commander password in clear. D-5 and this repo's own
   * non-negotiables forbid exactly that, and lottery-setup.ts says so in its own header.
   */
  it("refuses a lottery PC on a StoreDesk route", async () => {
    await enableLottery();
    const pc = await activatePc(params.organizationId, params.storeId);
    const claimed = await call(vouchedClaim, request("POST", "/", { token: pc.token, body: { deviceName: "COUNTER-PC" } }), {});
    expect(claimed.status).toBe(201);

    const { GET: syncConfig } = await import("@/app/api/v1/edge/sync/config/route");
    const res = await call(syncConfig, request("GET", "/", { token: claimed.body.workerCredential }), {});

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain("WRONG_PRODUCT");
    expect(JSON.stringify(res.body)).not.toContain("posPassword");
  });

  it("still lets the StoreDesk PC use its own routes", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const { GET: syncConfig } = await import("@/app/api/v1/edge/sync/config/route");
    const res = await call(syncConfig, request("GET", "/", { token: pc.token }), {});
    expect(res.status).toBe(200);
  });
});
