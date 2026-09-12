import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { PUT as putSettings } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/route";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { assertSheetNotInOtherOrganization } from "@/lib/store-sheets";
import { createStore } from "@/lib/tenant-stores";
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
 * StoreDesk's Google account opens every sheet shared with it, so one sheet
 * belongs to one organization (409 SHEET_IN_USE). The sheet is connected on
 * the store PC and reported by it (next phase), which is where the rule
 * applies; the admin can only switch Google Sheets on or off.
 */

setupMemoryMongo();

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const OTHER_ID = "1ZzOtherCustomersSheet000000000000000";
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

describe("one sheet, one organization", () => {
  it("refuses a sheet another organization's store uses, and allows it for another store of the same organization", async () => {
    await reported(a.store.storeId, SHEET_ID);
    const refused = await assertSheetNotInOtherOrganization(b.organization.organizationId, SHEET_ID).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ControlPlaneError);
    expect(refused).toMatchObject({ status: 409, code: "SHEET_IN_USE" });

    const { store: second } = await createStore(admin, a.organization.organizationId, { name: "Store 17" });
    await expect(assertSheetNotInOtherOrganization(a.organization.organizationId, SHEET_ID)).resolves.toBeUndefined();
    await reported(second.storeId, SHEET_ID);
    await expect(assertSheetNotInOtherOrganization(b.organization.organizationId, OTHER_ID)).resolves.toBeUndefined();
  });

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
