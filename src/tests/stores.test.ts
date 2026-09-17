import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as list, POST as create } from "@/app/api/v1/admin/organizations/[organizationId]/stores/route";
import * as storeRoute from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/route";
import { DELETE as remove, GET as detail, PATCH as patch } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/route";
import * as tunnelRoute from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/tunnel/route";
import { POST as retryTunnel } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/tunnel/route";
import { GET as preview } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/access-preview/route";
import { createOrganization, updateOrganization } from "@/lib/organizations";
import { updateStoreSettings } from "@/lib/tenant-stores";
import { addUser } from "@/lib/users";
import { deleteCloudflareTunnel, provisionCloudflareTunnel, rotateCloudflareTunnel } from "@/lib/cloudflare";
import { revokeInstallationsAndNotify, scheduleNotify } from "@/lib/store-notify";
import {
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-notify")>();
  return {
    ...actual,
    scheduleNotify: vi.fn(),
    scheduleAppUserNotify: vi.fn(),
    revokeInstallationsAndNotify: vi.fn(actual.revokeInstallationsAndNotify)
  };
});
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn(async () => ({ cloudflareToken: "rotated" }))
}));

/** Stores: create on a license seat, the tunnel outcome (P6), details, delete, access preview. */

setupMemoryMongo();

let admin: TestAdmin;

function useCloudflare() {
  process.env.CLOUDFLARE_API_TOKEN = "cf-test-token";
  process.env.CLOUDFLARE_ACCOUNT_ID = "cf-account";
}

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
});
afterEach(() => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

async function orgWithLicense() {
  const { organization, license } = await createOrganization(admin, {
    name: "Example Retail",
    slug: "example-retail",
    license: { plan: "standard", maxPcsPerStore: 1 }
  });
  return { organizationId: organization.organizationId, licenseId: license!.licenseId };
}

function createStoreCall(organizationId: string, body: unknown) {
  return call(create, request("POST", "/", { token: admin.token, body }), { organizationId });
}

describe("POST …/stores", () => {
  it("creates a store and reports the tunnel as not configured when Cloudflare is off", async () => {
    const { organizationId } = await orgWithLicense();
    const res = await createStoreCall(organizationId, {
      name: "Store 42",
      storeNumber: "42",
      contactEmail: "S42@Example.invalid",
      timeZone: "America/Chicago"
    });
    expect(res.status).toBe(201);
    expect(res.body.tunnel.status).toBe("not_configured");
    expect(res.body.store).toMatchObject({
      name: "Store 42",
      contactEmail: "s42@example.invalid",
      timeZone: "America/Chicago",
      status: "active",
      settingsVersion: 1,
      capabilities: { lottery: null, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null },
      installation: null
    });
    expect(res.body.store.tunnel).toMatchObject({ status: "not_configured", url: null });
    expect(res.body.store.tunnel.message).toContain("CLOUDFLARE_API_TOKEN");
    expect(provisionCloudflareTunnel).not.toHaveBeenCalled();
    expect(await lastAudit("store.create")).toMatchObject({ actorId: admin.adminId });
    expect((await lastAudit("store.tunnel.provision"))?.metadata).toMatchObject({ status: "not_configured" });
  });

  it("creates the tunnel under <org tag>-<store name> and never returns its token", async () => {
    useCloudflare();
    vi.mocked(provisionCloudflareTunnel).mockResolvedValueOnce({
      cloudflareToken: "CF_TOKEN_MUST_NOT_LEAK",
      tunnelUrl: "https://example-retail-store-42.tunnels.example",
      tunnelId: "cf-tunnel-1",
      dnsRecordId: "dns-1"
    });
    const { organizationId } = await orgWithLicense();
    const res = await createStoreCall(organizationId, { name: "Store 42" });
    expect(res.status).toBe(201);
    expect(res.body.tunnel).toEqual({ status: "ok", url: "https://example-retail-store-42.tunnels.example", message: null });
    expect(vi.mocked(provisionCloudflareTunnel).mock.calls[0][1]).toBe("example-retail-store-42");
    expect(JSON.stringify(res.body)).not.toContain("CF_TOKEN_MUST_NOT_LEAK");
    const got = await call(detail, request("GET", "/", { token: admin.token }), { organizationId, storeId: res.body.store.storeId });
    expect(got.body.store.tunnel.status).toBe("ok");
    expect(JSON.stringify(got.body)).not.toContain("CF_TOKEN_MUST_NOT_LEAK");
  });

  it("records a failed tunnel, retries it, then rotates the live one", async () => {
    useCloudflare();
    vi.mocked(provisionCloudflareTunnel).mockRejectedValueOnce(new Error("tunnel name already taken"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { organizationId } = await orgWithLicense();
    const res = await createStoreCall(organizationId, { name: "Store 42" });
    quiet.mockRestore();
    expect(res.status).toBe(201);
    expect(res.body.tunnel).toMatchObject({ status: "failed", message: "tunnel name already taken" });
    const storeId = res.body.store.storeId;
    expect(res.body.store.tunnel.status).toBe("failed");

    vi.mocked(provisionCloudflareTunnel).mockResolvedValueOnce({
      cloudflareToken: "t",
      tunnelUrl: "https://s42.tunnels.example",
      tunnelId: "cf-tunnel-9",
      dnsRecordId: null
    });
    const retried = await call(retryTunnel, request("POST", "/", { token: admin.token }), { organizationId, storeId });
    expect(retried.status).toBe(200);
    expect(retried.body.tunnel).toMatchObject({ status: "ok", url: "https://s42.tunnels.example" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId, reason: "tunnel.rotate" });
    expect((await lastAudit("store.tunnel.provision"))?.metadata).toMatchObject({ status: "ok", retry: true });

    const again = await call(retryTunnel, request("POST", "/", { token: admin.token }), { organizationId, storeId });
    expect(again.status).toBe(200);
    expect(rotateCloudflareTunnel).toHaveBeenCalledWith("cf-tunnel-9");
    expect(await lastAudit("store.tunnel.rotate")).toBeTruthy();
  });

  it("answers a tunnel retry with 503 when Cloudflare is off and 502 when it refuses", async () => {
    const { organizationId } = await orgWithLicense();
    const { body } = await createStoreCall(organizationId, { name: "Store 42" });
    const storeId = body.store.storeId;
    const off = await call(retryTunnel, request("POST", "/", { token: admin.token }), { organizationId, storeId });
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe("TUNNEL_NOT_CONFIGURED");
    expect(off.body.tunnel.status).toBe("not_configured");

    useCloudflare();
    vi.mocked(provisionCloudflareTunnel).mockRejectedValueOnce(new Error("quota"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const refused = await call(retryTunnel, request("POST", "/", { token: admin.token }), { organizationId, storeId });
    quiet.mockRestore();
    expect(refused.status).toBe(502);
    expect(refused.body.error.code).toBe("TUNNEL_PROVISION_FAILED");
    expect(refused.body.tunnel).toMatchObject({ status: "failed", message: "quota" });
  });

  it("a master-license organization covers every new store; a store license is refused there", async () => {
    const { organizationId, licenseId } = await orgWithLicense();
    for (const name of ["One", "Two", "Three"]) {
      const created = await createStoreCall(organizationId, { name });
      expect(created.status).toBe(201);
      expect(created.body.store.license).toMatchObject({ licenseId, scope: "organization" });
    }
    const own = await createStoreCall(organizationId, { name: "Four", storeLicense: { plan: "trial" } });
    expect(own.status).toBe(409);
    expect(own.body.error.code).toBe("LICENSE_MODE_MISMATCH");
  });

  it("store-wise: issues the store's license now or leaves it Unlicensed; a suspended organization is refused", async () => {
    const { organization } = await createOrganization(admin, { name: "Corner Mart", slug: "corner-mart", licensingMode: "storeWise" });
    const unlicensed = await createStoreCall(organization.organizationId, { name: "S" });
    expect(unlicensed.status).toBe(201);
    expect(unlicensed.body.store).toMatchObject({ licenseId: null, license: null });
    const licensed = await createStoreCall(organization.organizationId, { name: "T", storeLicense: { plan: "trial", entitlementDays: 30 } });
    expect(licensed.body.store.license).toMatchObject({ scope: "store", plan: "trial", status: "trialing" });
    const past = await createStoreCall(organization.organizationId, { name: "U", storeLicense: { plan: "trial", entitlementExpiresAt: "2020-01-01T00:00:00Z" } });
    expect(past.status).toBe(400);
    expect(await TenantStoreModel.countDocuments({ name: "U" })).toBe(0);

    const { organizationId } = await orgWithLicense();
    await updateOrganization(admin, organizationId, { status: "suspended" });
    const suspended = await createStoreCall(organizationId, { name: "S" });
    expect(suspended.status).toBe(409);
    expect(suspended.body.error.code).toBe("ORGANIZATION_SUSPENDED");
  });

  it.each([
    ["no name", {}],
    ["an unknown time zone", { name: "S", timeZone: "Mars/Olympus" }],
    ["a bad contact e-mail", { name: "S", contactEmail: "not an email" }]
  ])("answers 400 for %s", async (_label, body) => {
    const { organizationId } = await orgWithLicense();
    expect((await createStoreCall(organizationId, body)).status).toBe(400);
  });

  it("answers 401 without a session", async () => {
    expect((await call(list, request("GET", "/"), { organizationId: "org_x" })).status).toBe(401);
    expect((await call(create, request("POST", "/", { body: { name: "x" } }), { organizationId: "org_x" })).status).toBe(401);
  });
});

describe("GET, PATCH, PUT and DELETE …/stores/{store}", () => {
  it("lists and shows stores with their PC, tunnel and time zone", async () => {
    const { organization, license, store } = await seedOrganization(admin);
    await activatePc(organization.organizationId, store.storeId);
    const listed = await call(list, request("GET", "/", { token: admin.token }), { organizationId: organization.organizationId });
    expect(listed.status).toBe(200);
    expect(listed.body.stores[0].installation).toMatchObject({ status: "active" });
    expect(listed.body.stores[0]).toHaveProperty("timeZone");
    const shown = await call(detail, request("GET", "/", { token: admin.token }), {
      organizationId: organization.organizationId,
      storeId: store.storeId
    });
    expect(shown.body.license).toMatchObject({ licenseId: license.licenseId, scope: "organization" });
    expect(listed.body.stores[0].license.licenseNumber).toBe(license.licenseNumber);
    expect((await call(detail, request("GET", "/", { token: admin.token }), { organizationId: organization.organizationId, storeId: "store_nope" })).status).toBe(404);
  });

  it("edits details and status, audits, and notifies the store", async () => {
    const { organization, store } = await seedOrganization(admin);
    const params = { organizationId: organization.organizationId, storeId: store.storeId };
    const res = await call(patch, request("PATCH", "/", { token: admin.token, body: { name: "Store 42 · Main", status: "suspended", address: null } }), params);
    expect(res.status).toBe(200);
    expect(res.body.store).toMatchObject({ name: "Store 42 · Main", status: "suspended", address: null });
    expect((await lastAudit("store.update"))?.metadata).toMatchObject({ status: "suspended", previousStatus: "active" });
    expect(scheduleNotify).toHaveBeenCalledWith({ ...params, reason: "store.update" });
    for (const body of [{ status: "pending" }, {}, { configJson: "{}" }]) {
      expect((await call(patch, request("PATCH", "/", { token: admin.token, body }), params)).status).toBe(400);
    }
  });

  it("has no whole-store PUT (P2) and no tunnel DELETE any more", () => {
    expect(Object.keys(storeRoute).sort()).toEqual(["DELETE", "GET", "PATCH"]);
    expect(Object.keys(tunnelRoute)).toEqual(["POST"]);
  });

  it("deletes a store after revoking its PC, with its PC, keys, credentials and assignments", async () => {
    const { organization, store } = await seedOrganization(admin);
    const organizationId = organization.organizationId;
    const pc = await activatePc(organizationId, store.storeId);
    await addUser(admin, organizationId, {
      mode: "managed",
      email: "clerk@example.invalid",
      password: "password-1",
      assignments: [{ storeId: store.storeId, role: "cashier" }]
    });
    const res = await call(remove, request("DELETE", "/", { token: admin.token }), { organizationId, storeId: store.storeId });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: store.storeId });
    expect(revokeInstallationsAndNotify).toHaveBeenCalledWith({ organizationId, storeId: store.storeId, reason: "store.delete" });
    // No tunnel was ever created here (Cloudflare is off), so there is nothing to delete.
    expect(deleteCloudflareTunnel).not.toHaveBeenCalled();
    expect(await TenantStoreModel.countDocuments({ storeId: store.storeId })).toBe(0);
    expect(await WorkerInstallationModel.countDocuments({ workerInstallationId: pc.workerInstallationId })).toBe(0);
    expect(await WorkerCredentialModel.countDocuments({ workerInstallationId: pc.workerInstallationId })).toBe(0);
    expect(await UserAssignmentModel.countDocuments({ storeId: store.storeId })).toBe(0);
    expect(await lastAudit("store.delete")).toMatchObject({ targetId: store.storeId });
  });
});

describe("GET …/stores/{store}/access-preview", () => {
  it("hides pages that need a feature the store lacks, per role", async () => {
    const { organization, store } = await seedOrganization(admin);
    const params = { organizationId: organization.organizationId, storeId: store.storeId };
    await addUser(admin, organization.organizationId, {
      mode: "managed",
      email: "owner@example.invalid",
      password: "password-1",
      assignments: [{ storeId: null, role: "org_admin" }]
    });
    // Not answered stays null, and as in both apps a fuel page shows only on a literal true.
    const unanswered = await call(preview, request("GET", "/", { token: admin.token }), params);
    expect(unanswered.body.capabilities).toEqual({ lottery: null, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null });
    const unansweredAdmins = unanswered.body.roles.find((role: { roleId: string }) => role.roleId === "org_admin");
    expect(unansweredAdmins.electron.find((page: { key: string }) => page.key === "fuelPrices")).toMatchObject({ hiddenBecause: "fuel", allowed: false });
    expect(unansweredAdmins.mobile.find((page: { key: string }) => page.key === "mobileFuelPrices")).toMatchObject({ hiddenBecause: "fuel", allowed: false });
    expect(unansweredAdmins.electron.find((page: { key: string }) => page.key === "pos")).toMatchObject({ hiddenBecause: null, allowed: true });

    await updateStoreSettings(admin, organization.organizationId, store.storeId, { capabilities: { fuel: false, lottery: false, coam: false, ebt: false, moneyOrder: false, prepaidGift: false } }, 1);
    const before = await call(preview, request("GET", "/", { token: admin.token }), params);
    expect(before.status).toBe(200);
    expect(before.body.capabilities).toEqual({ lottery: false, coam: false, fuel: false, ebt: false, moneyOrder: false, prepaidGift: false });
    const admins = before.body.roles.find((role: { roleId: string }) => role.roleId === "org_admin");
    expect(admins.userCount).toBe(1);
    expect(admins.electron.find((page: { key: string }) => page.key === "fuelPrices")).toMatchObject({
      hiddenBecause: "fuel",
      allowed: false,
      requiresCapability: "fuel"
    });
    expect(admins.mobile.find((page: { key: string }) => page.key === "mobileFuelPrices").hiddenBecause).toBe("fuel");
    expect(admins.electron.find((page: { key: string }) => page.key === "pos")).toMatchObject({ allowed: true, hiddenBecause: null });
    const cashier = before.body.roles.find((role: { roleId: string }) => role.roleId === "cashier");
    expect(cashier.electron.map((page: { key: string }) => page.key)).not.toContain("fuelPrices");

    await updateStoreSettings(admin, organization.organizationId, store.storeId, { capabilities: { fuel: true, lottery: false, coam: false, ebt: false, moneyOrder: false, prepaidGift: false } }, 2);
    const after = await call(preview, request("GET", "/", { token: admin.token }), params);
    const adminsAfter = after.body.roles.find((role: { roleId: string }) => role.roleId === "org_admin");
    expect(adminsAfter.electron.find((page: { key: string }) => page.key === "fuelPrices").allowed).toBe(true);
    expect((await call(preview, request("GET", "/"), params)).status).toBe(401);
  });
});
