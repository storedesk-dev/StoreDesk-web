import { describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, request } from "./helpers/api";
import { seedDevData } from "@/lib/dev-seed";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as enroll } from "@/app/api/v1/app-auth/enroll/route";
import { normalizeStoreSettings } from "@/lib/store-settings";
import { coveringLicense } from "@/lib/licenses";
import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel
} from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));

/** `npm run dev:local`'s sample data, built through the same calls the admin routes use. */

setupMemoryMongo();

describe("seedDevData", () => {
  it("seeds an admin, a master-license and a store-wise organization, four roles and both kinds of user", async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    const seed = await seedDevData({ adminPassword: "local-admin-pass", userPassword: "local-user-pass" });
    expect(seed.admin).toEqual({ email: "admin@storedesk.local", password: "local-admin-pass" });

    const signIn = await call(
      login,
      request("POST", "/api/admin/login", { body: { email: seed.admin.email, password: seed.admin.password } })
    );
    expect(signIn.status).toBe(200);

    const org = await OrganizationModel.findOne({ slug: "example-retail" }).lean();
    expect((org?.roles as Array<{ roleId: string }>).map((role) => role.roleId)).toEqual([
      "org_admin",
      "store_manager",
      "cashier",
      "viewer"
    ]);

    expect(org?.licensing).toEqual({ mode: "master" });
    const corner = await OrganizationModel.findOne({ slug: "corner-mart" }).lean();
    expect(corner).toMatchObject({ name: "Corner Mart Group", licensing: { mode: "storeWise" } });

    const master = await LicenseModel.findOne({ scope: "organization" }).lean();
    const storeLicense = await LicenseModel.findOne({ scope: "store" }).lean();
    expect(master).toMatchObject({ organizationId: org?.organizationId, status: "active", plan: "standard" });
    expect(storeLicense).toMatchObject({ organizationId: corner?.organizationId, status: "active" });

    const byName = async (prefix: string) => (await TenantStoreModel.findOne({ name: new RegExp(`^${prefix}`) }).lean())!;
    const main = await byName("Store 42");
    const elm = await byName("Store 17");
    const hwy = await byName("Store 88");
    const five = await byName("Store 5 ");
    const six = await byName("Store 6 ");
    for (const store of [main, elm, hwy]) expect((await coveringLicense(store))?.licenseId).toBe(master?.licenseId);
    expect((await coveringLicense(five))?.licenseId).toBe(storeLicense?.licenseId);
    expect(await coveringLicense(six)).toBeNull();
    expect(seed.stores.map((store) => store.license)).toEqual([
      `master license ${master?.licenseNumber}`,
      `master license ${master?.licenseNumber}`,
      `master license ${master?.licenseNumber}`,
      `own license ${storeLicense?.licenseNumber}`,
      "Unlicensed"
    ]);
    expect(seed.organizations.map((entry) => entry.slug)).toEqual(["example-retail", "corner-mart"]);
    expect(normalizeStoreSettings(main.settings).capabilities).toEqual({ fuel: true, lottery: true, coam: false, ebt: true, moneyOrder: true, prepaidGift: false });
    expect(normalizeStoreSettings(main.settings).integrations.googleSheets).toMatchObject({ enabled: true, spreadsheetId: null });
    expect(normalizeStoreSettings(elm.settings).capabilities).toEqual({ fuel: false, lottery: false, coam: false, ebt: false, moneyOrder: false, prepaidGift: false });
    expect((await TenantStoreModel.find({}).lean()).every((store) => store.tunnelStatus === "not_configured" && !store.tunnelUrl)).toBe(true);

    const users = await AppUserModel.find({}).lean();
    expect(users.map((user) => user.status).sort()).toEqual(["active", "active", "pending_enrollment"]);
    expect(users.filter((user) => user.loginType === "managed")).toHaveLength(2);
    expect(await UserAssignmentModel.countDocuments({ status: "active" })).toBe(3);
    expect(await SetupKeyModel.countDocuments({ status: "shown" })).toBe(1);

    const invited = seed.users.find((user) => user.kind === "invite")!;
    const enrolled = await call(
      enroll,
      request("POST", "/api/v1/app-auth/enroll", {
        body: { enrollmentCredential: invited.invitationCode, password: "a-new-password", deviceName: "web", audience: "desktop" }
      })
    );
    expect(enrolled.status).toBe(201);
  });
});
