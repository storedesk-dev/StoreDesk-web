import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as getSettings, PUT as putSettings } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/route";
import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { GET as lookup } from "@/app/api/v1/app-auth/organizations/[slug]/route";
import { updateOrganization } from "@/lib/organizations";
import { updateStore } from "@/lib/tenant-stores";
import { scheduleNotify } from "@/lib/store-notify";
import { AuditEventModel, TenantStoreModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/**
 * Store settings (P2): a strict schema, saved on top of the version read (409
 * otherwise), audited, notified — and what reaches the store in the access
 * sync. Plus suspension (P12): the store's pull answers 403 STORE_SUSPENDED.
 */

setupMemoryMongo();

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const SHEET = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;
const OTHER_ID = "1ZzSomeoneElsesSheet00000000000000000";
let admin: TestAdmin;
let params: { organizationId: string; storeId: string };
let seeded: Awaited<ReturnType<typeof seedOrganization>>;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});

function put(body: unknown, headers: Record<string, string> = {}) {
  return call(putSettings, request("PUT", "/", { token: admin.token, body, headers }), params);
}

describe("GET …/settings", () => {
  it("answers the defaults at version 1, with the Google account when it is known", async () => {
    const res = await call(getSettings, request("GET", "/", { token: admin.token }), params);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      settings: {
        capabilities: { lottery: false, coam: false, fuel: false },
        lottery: { setupMode: null },
        integrations: {
          googleSheets: { enabled: false, spreadsheetUrl: null, spreadsheetId: null, sheetName: null, headerRow: 1 },
          gtc: { status: "coming_soon" }
        },
        timeZone: null
      },
      settingsVersion: 1,
      googleClientEmail: null
    });
    expect((await call(getSettings, request("GET", "/"), params)).status).toBe(401);
  });

  it("reads a store written by an older build, with no settings at all, as the defaults", async () => {
    await TenantStoreModel.collection.updateOne({ storeId: params.storeId }, { $unset: { settings: 1, settingsVersion: 1 } });
    const res = await call(getSettings, request("GET", "/", { token: admin.token }), params);
    expect(res.body.settingsVersion).toBe(1);
    expect(res.body.settings.capabilities.fuel).toBe(false);
    const saved = await put({ settingsVersion: 1, settings: { capabilities: { fuel: true, lottery: false, coam: false } } });
    expect(saved.status).toBe(200);
    expect(saved.body.settingsVersion).toBe(2);
  });
});

describe("PUT …/settings", () => {
  it("saves features on top of the version read, audits and notifies the store", async () => {
    const res = await put({ settingsVersion: 1, settings: { capabilities: { fuel: true, lottery: true, coam: false } } });
    expect(res.status).toBe(200);
    expect(res.body.settingsVersion).toBe(2);
    expect(res.body.settings.capabilities).toEqual({ fuel: true, lottery: true, coam: false });
    const audit = await lastAudit("store.settings.update");
    expect(audit).toMatchObject({ storeId: params.storeId, actorId: admin.adminId });
    expect(audit?.metadata).toMatchObject({ changed: ["capabilities"], settingsVersion: 2 });
    expect(scheduleNotify).toHaveBeenCalledWith({ ...params, reason: "store.settings.update" });
  });

  it("answers 409 SETTINGS_VERSION_CONFLICT with the current settings for a stale version", async () => {
    await put({ settingsVersion: 1, settings: { capabilities: { fuel: true, lottery: false, coam: false } } });
    const stale = await put({ settingsVersion: 1, settings: { timeZone: "America/Denver" } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("SETTINGS_VERSION_CONFLICT");
    expect(stale.body.settingsVersion).toBe(2);
    expect(stale.body.settings.capabilities.fuel).toBe(true);
  });

  it("takes the version from If-Match, and answers 428 with no version at all", async () => {
    expect((await put({ timeZone: "America/New_York" }, { "If-Match": '"1"' })).body.settingsVersion).toBe(2);
    const missing = await put({ settings: { timeZone: "America/Chicago" } });
    expect(missing.status).toBe(428);
    expect(missing.body.error.code).toBe("SETTINGS_VERSION_REQUIRED");
  });

  it("accepts the GET body echoed back with a change: the switch is saved, sheet fields sent are ignored", async () => {
    // The sheet the store PC reported (the edge route comes next phase).
    await TenantStoreModel.collection.updateOne(
      { storeId: params.storeId },
      { $set: { "settings.integrations.googleSheets": { enabled: false, spreadsheetUrl: SHEET, spreadsheetId: SHEET_ID, sheetName: "Daily", headerRow: 2 } } }
    );
    const { body } = await call(getSettings, request("GET", "/", { token: admin.token }), params);
    body.settings.integrations.googleSheets = {
      enabled: true,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${OTHER_ID}/edit`,
      spreadsheetId: OTHER_ID,
      sheetName: "Other",
      headerRow: 9
    };
    body.settings.timeZone = "America/New_York";
    const res = await put({ settingsVersion: body.settingsVersion, settings: body.settings });
    expect(res.status).toBe(200);
    expect(res.body.settings.integrations.googleSheets).toEqual({
      enabled: true,
      spreadsheetUrl: SHEET,
      spreadsheetId: SHEET_ID,
      sheetName: "Daily",
      headerRow: 2
    });
    expect((await lastAudit("store.settings.update"))?.metadata).toMatchObject({ changed: ["integrations", "timeZone"] });
  });

  it("turns Google Sheets on and off with the switch alone; no sheet is needed", async () => {
    const on = await put({ settingsVersion: 1, settings: { integrations: { googleSheets: { enabled: true } } } });
    expect(on.status).toBe(200);
    expect(on.body.settings.integrations.googleSheets).toEqual({ enabled: true, spreadsheetUrl: null, spreadsheetId: null, sheetName: null, headerRow: 1 });
    const off = await put({ settingsVersion: 2, settings: { integrations: { googleSheets: { enabled: false } } } });
    expect(off.status).toBe(200);
    expect(off.body.settingsVersion).toBe(3);
    expect(off.body.settings.integrations.googleSheets.enabled).toBe(false);
  });

  it("writes nothing for an update that changes nothing", async () => {
    vi.mocked(scheduleNotify).mockClear();
    const res = await put({ settingsVersion: 1, settings: { capabilities: { fuel: false, lottery: false, coam: false } } });
    expect(res.status).toBe(200);
    expect(res.body.settingsVersion).toBe(1);
    expect(await AuditEventModel.countDocuments({ action: "store.settings.update" })).toBe(0);
    expect(scheduleNotify).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown feature", { settingsVersion: 1, settings: { capabilities: { fuel: true, lottery: false, coam: false, carWash: true } } }],
    ["a missing feature", { settingsVersion: 1, settings: { capabilities: { fuel: true } } }],
    ["a non-boolean feature", { settingsVersion: 1, settings: { capabilities: { fuel: "yes", lottery: false, coam: false } } }],
    ["an unknown time zone", { settingsVersion: 1, settings: { timeZone: "Mars/Olympus" } }],
    ["a lottery mode", { settingsVersion: 1, settings: { lottery: { setupMode: "scratch" } } }],
    ["a free-form config", { settingsVersion: 1, settings: { configJson: "{}" } }],
    ["a register password", { settingsVersion: 1, settings: { posPassword: "x" } }],
    ["an extra top-level field", { settingsVersion: 1, settings: {}, name: "x" }],
    ["a Google Sheets switch that is not a boolean", { settingsVersion: 1, settings: { integrations: { googleSheets: { enabled: "on" } } } }],
    ["a Google Sheets switch left out", { settingsVersion: 1, settings: { integrations: { googleSheets: { spreadsheetUrl: SHEET } } } }],
    ["an unknown Google Sheets field", { settingsVersion: 1, settings: { integrations: { googleSheets: { enabled: true, serviceAccountKey: "x" } } } }]
  ])("answers 400 for %s", async (_label, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
  });

});

describe("what the store receives, and suspension (P12)", () => {
  async function pull(token: string) {
    return call(accessSync, request("GET", "/api/v1/edge/sync/access", { headers: { Authorization: `Bearer ${token}` } }));
  }

  it("carries capabilities, settings and settingsVersion, and the content version follows them", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const first = await pull(pc.token);
    expect(first.status).toBe(200);
    expect(first.body.store).toMatchObject({
      capabilities: { lottery: false, coam: false, fuel: false },
      settingsVersion: 1,
      settings: { lottery: { setupMode: null }, timeZone: null }
    });
    expect(first.body.store.settings.integrations.gtc).toEqual({ status: "coming_soon" });

    expect(first.body.store.settings.integrations.googleSheets.enabled).toBe(false);

    await put({
      settingsVersion: 1,
      settings: { capabilities: { fuel: true, lottery: false, coam: false }, integrations: { googleSheets: { enabled: true } } }
    });
    const second = await pull(pc.token);
    expect(second.body.store.capabilities.fuel).toBe(true);
    expect(second.body.store.settings.integrations.googleSheets.enabled).toBe(true);
    expect(second.body.store.settingsVersion).toBe(2);
    expect(second.body.version).not.toBe(first.body.version);
  });

  it("answers 403 STORE_SUSPENDED for a suspended store or organization, and works again once reactivated", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await updateStore(admin, params.organizationId, params.storeId, { status: "suspended" });
    const store = await pull(pc.token);
    expect(store.status).toBe(403);
    expect(store.body.error).toMatchObject({ code: "STORE_SUSPENDED", message: "This store is suspended in StoreDesk." });
    const hidden = await call(lookup, request("GET", "/"), { slug: "example-retail" });
    expect(hidden.body.stores).toEqual([]);

    await updateStore(admin, params.organizationId, params.storeId, { status: "active" });
    await updateOrganization(admin, params.organizationId, { status: "suspended" });
    expect((await pull(pc.token)).status).toBe(403);

    await updateOrganization(admin, params.organizationId, { status: "active" });
    expect((await pull(pc.token)).status).toBe(200);
  });
});
