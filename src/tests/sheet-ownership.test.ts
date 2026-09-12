import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { PUT as putSettings } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/route";
import { POST as checkSheet } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/google-sheets/check/route";
import { createStore } from "@/lib/tenant-stores";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(),
  rotateCloudflareTunnel: vi.fn()
}));

/**
 * StoreDesk's Google account opens every sheet shared with it, so one sheet
 * belongs to one organization: a second organization cannot attach it (409
 * SHEET_IN_USE), in settings or in the sheet check.
 */

setupMemoryMongo();

const SHEET = "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit";
let admin: TestAdmin;
let a: Awaited<ReturnType<typeof seedOrganization>>;
let b: Awaited<ReturnType<typeof seedOrganization>>;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  a = await seedOrganization(admin);
  b = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
});

function attach(organizationId: string, storeId: string) {
  return call(
    putSettings,
    request("PUT", "/", {
      token: admin.token,
      body: { settingsVersion: 1, settings: { integrations: { googleSheets: { enabled: true, spreadsheetUrl: SHEET, sheetName: null, headerRow: 1 } } } }
    }),
    { organizationId, storeId }
  );
}

describe("one sheet, one organization", () => {
  it("refuses a sheet another organization's store already uses, and allows it for another store of the same organization", async () => {
    expect((await attach(a.organization.organizationId, a.store.storeId)).status).toBe(200);
    const other = await attach(b.organization.organizationId, b.store.storeId);
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe("SHEET_IN_USE");
    const { store: second } = await createStore(admin, a.organization.organizationId, { name: "Store 17" });
    expect((await attach(a.organization.organizationId, second.storeId)).status).toBe(200);
  });

  it("the sheet check refuses it too, before asking Google", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "sheets@example.invalid", private_key: "unused" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await attach(a.organization.organizationId, a.store.storeId);
    const res = await call(
      checkSheet,
      request("POST", "/", { token: admin.token, body: { spreadsheetUrl: SHEET } }),
      { organizationId: b.organization.organizationId, storeId: b.store.storeId }
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SHEET_IN_USE");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
