import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { PUT as putSettings } from "@/app/api/v1/admin/stores/[storeId]/settings/route";
import { TenantStoreModel } from "@/models/ControlPlane";

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
 * The sheet is connected on the store PC; the admin can only switch Google
 * Sheets on or off. A sheet in the admin's save is ignored, so the admin
 * console can never claim another business's sheet.
 */

setupMemoryMongo();

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
let admin: TestAdmin;
let a: Awaited<ReturnType<typeof seedOrganization>>;
let b: Awaited<ReturnType<typeof seedOrganization>>;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  a = await seedOrganization(admin);
  b = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
});

/** A sheet the store PC reported. */
async function reported(storeId: string, spreadsheetId: string) {
  await TenantStoreModel.collection.updateOne(
    { storeId },
    { $set: { "settings.integrations.googleSheets.spreadsheetId": spreadsheetId } }
  );
}

describe("the admin cannot attach a sheet", () => {
  it("the admin settings cannot attach a sheet: the fields are ignored and nothing is claimed", async () => {
    await reported(a.store.storeId, SHEET_ID);
    const res = await call(
      putSettings,
      request("PUT", "/", {
        token: admin.token,
        body: {
          settingsVersion: 1,
          settings: {
            integrations: {
              googleSheets: {
                enabled: true,
                spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
                spreadsheetId: SHEET_ID,
                sheetName: "Daily",
                headerRow: 1
              }
            }
          }
        }
      }),
      { organizationId: b.organization.organizationId, storeId: b.store.storeId }
    );
    expect(res.status).toBe(200);
    expect(res.body.settings.integrations.googleSheets).toMatchObject({ enabled: true, spreadsheetId: null, spreadsheetUrl: null });
    expect(await TenantStoreModel.countDocuments({ "settings.integrations.googleSheets.spreadsheetId": SHEET_ID })).toBe(1);
  });
});
