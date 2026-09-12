import { describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, request } from "./helpers/api";
import { seedDevData } from "@/lib/dev-seed";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as enroll } from "@/app/api/v1/app-auth/enroll/route";
import { normalizeStoreSettings } from "@/lib/store-settings";
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
  it("seeds an admin, an organization license, stores licensed every way, four roles and both kinds of user", async () => {
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

    const orgLicense = await LicenseModel.findOne({ scope: "organization" }).lean();
    const storeLicense = await LicenseModel.findOne({ scope: "store" }).lean();
    expect(orgLicense).toMatchObject({ status: "active", maxStores: 5 });
    expect(storeLicense).toMatchObject({ status: "trialing", plan: "trial" });

    const byName = async (prefix: string) => (await TenantStoreModel.findOne({ name: new RegExp(`^${prefix}`) }).lean())!;
    const main = await byName("Store 42");
    const elm = await byName("Store 17");
    const hwy = await byName("Store 88");
    const pine = await byName("Store 90");
    expect(main.licenseId).toBe(orgLicense?.licenseId);
    expect(elm.licenseId).toBe(orgLicense?.licenseId);
    expect(hwy.licenseId).toBe(storeLicense?.licenseId);
    expect(storeLicense?.storeId).toBe(hwy.storeId);
    expect(pine.licenseId).toBeNull();
    expect(seed.stores.map((store) => store.license)).toEqual([
      `organization license ${orgLicense?.licenseNumber}`,
      `organization license ${orgLicense?.licenseNumber}`,
      `own trial license ${storeLicense?.licenseNumber}`,
      "unlicensed"
    ]);
    expect(normalizeStoreSettings(main.settings).capabilities).toEqual({ fuel: true, lottery: true, coam: false });
    expect(normalizeStoreSettings(elm.settings).capabilities).toEqual({ fuel: false, lottery: false, coam: false });
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
