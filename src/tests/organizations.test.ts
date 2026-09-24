import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as list, POST as create } from "@/app/api/v1/admin/organizations/route";
import { DELETE as remove, GET as detail, PATCH as patch } from "@/app/api/v1/admin/organizations/[organizationId]/route";
import { GET as lookup } from "@/app/api/v1/app-auth/organizations/[slug]/route";
import { addUser } from "@/lib/users";
import { revokeInstallationsAndNotify, scheduleNotify } from "@/lib/store-notify";
import { deleteCloudflareTunnel } from "@/lib/cloudflare";
import {
  AppUserModel,
  AuditEventModel,
  LicenseModel,
  OrganizationModel,
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
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/** Organizations: org-tag rule and 409 (P15), status and suspension (P12), delete cascade by id lists (P5). */

setupMemoryMongo();

const ORGS = "/api/v1/admin/organizations";
let admin: TestAdmin;

beforeEach(async () => {
  vi.clearAllMocks();
  delete process.env.CLOUDFLARE_API_TOKEN;
  admin = await createAdmin();
});

describe("without a staff session", () => {
  it("every organization route answers 401", async () => {
    const params = { organizationId: "org_x" };
    expect((await call(list, request("GET", ORGS))).status).toBe(401);
    expect((await call(create, request("POST", ORGS, { body: { name: "x" } }))).status).toBe(401);
    expect((await call(detail, request("GET", `${ORGS}/org_x`), params)).status).toBe(401);
    expect((await call(patch, request("PATCH", `${ORGS}/org_x`, { body: { name: "y" } }), params)).status).toBe(401);
    expect((await call(remove, request("DELETE", `${ORGS}/org_x`, { body: { confirmSlug: "x" } }), params)).status).toBe(401);
  });
});

describe("POST /organizations", () => {
  it("creates an organization with the four role templates at version 1, and audits", async () => {
    const res = await call(
      create,
      request("POST", ORGS, { token: admin.token, body: { name: "Example Retail", slug: "example-retail", billingEmail: "Billing@Example.invalid" } })
    );
    expect(res.status).toBe(201);
    expect(res.body.organization).toMatchObject({ name: "Example Retail", slug: "example-retail", billingEmail: "billing@example.invalid", status: "active" });
    expect(res.body.license).toBeNull();
    const org = await OrganizationModel.findOne({ slug: "example-retail" }).lean();
    const roles = org?.roles as Array<{ roleId: string; version: number }>;
    expect(roles.map((role) => role.roleId)).toEqual(["org_admin", "store_manager", "cashier", "viewer"]);
    expect(roles.every((role) => role.version === 1)).toBe(true);
    const audit = await lastAudit("organization.create");
    expect(audit).toMatchObject({ actorType: "internal_admin", actorId: admin.adminId, targetId: org?.organizationId });
  });

  it("derives the org tag from the name when none is given", async () => {
    const res = await call(create, request("POST", ORGS, { token: admin.token, body: { name: "Café Exprés #1" } }));
    expect(res.status).toBe(201);
    expect(res.body.organization.slug).toBe("cafe-expres-1");
  });

  it("issues no license: a license covers a store, and there are no stores yet", async () => {
    const res = await call(
      create,
      request("POST", ORGS, {
        token: admin.token,
        body: {
          name: "Trial Co",
          slug: "trial-co",
          license: { plan: "trial", entitlementDays: 30, maxPcsPerStore: 1, offlineGraceDays: 7 }
        }
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.license).toBeNull();
    expect(res.body.organization).not.toHaveProperty("licensingMode");
    expect(await LicenseModel.countDocuments({ organizationId: res.body.organization.organizationId })).toBe(0);
    expect(await lastAudit("license.create")).toBeFalsy();
  });

  it.each(["-bad", "bad-", "bad tag", "a".repeat(41), "under_score", "dots.here"])(
    "refuses the org tag %j with 400",
    async (slug) => {
      const res = await call(create, request("POST", ORGS, { token: admin.token, body: { name: "X", slug } }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("REQUEST_INVALID");
    }
  );

  it("answers 409 SLUG_TAKEN for an org tag in use, never 503", async () => {
    await call(create, request("POST", ORGS, { token: admin.token, body: { name: "A", slug: "taken" } }));
    const res = await call(create, request("POST", ORGS, { token: admin.token, body: { name: "B", slug: "taken" } }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SLUG_TAKEN");
  });

  it("answers 400 without a name, and for a body that is not JSON", async () => {
    expect((await call(create, request("POST", ORGS, { token: admin.token, body: { slug: "x" } }))).status).toBe(400);
    expect((await call(create, request("POST", ORGS, { token: admin.token, body: "{" }))).status).toBe(400);
  });
});

describe("GET /organizations and /organizations/{org}", () => {
  it("lists organizations with their counts, licensed stores and unlicensed ones", async () => {
    const { organization } = await seedOrganization(admin);
    const res = await call(list, request("GET", ORGS, { token: admin.token }));
    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(1);
    expect(res.body.organizations[0]).toMatchObject({
      organizationId: organization.organizationId,
      storeCount: 1,
      userCount: 0,
      storeLicenseCount: 1,
      unlicensedStoreCount: 0
    });
    const row = res.body.organizations[0];
    expect(row.storeLicenseCount + row.unlicensedStoreCount).toBe(row.storeCount);
  });

  it("shows one organization with counts, or 404", async () => {
    const { organization } = await seedOrganization(admin);
    const res = await call(detail, request("GET", "/", { token: admin.token }), { organizationId: organization.organizationId });
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ stores: 1, roles: 4, users: 0, licenses: 1, unlicensedStores: 0 });
    expect(res.body.organization).not.toHaveProperty("licensingMode");
    const missing = await call(detail, request("GET", "/", { token: admin.token }), { organizationId: "org_nope" });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("PATCH /organizations/{org}", () => {
  it("renames and suspends, audits, notifies the stores, and hides the organization from the phone lookup", async () => {
    const { organization } = await seedOrganization(admin);
    const organizationId = organization.organizationId;
    const res = await call(
      patch,
      request("PATCH", "/", { token: admin.token, body: { name: "Example Retail LLC", status: "suspended" } }),
      { organizationId }
    );
    expect(res.status).toBe(200);
    expect(res.body.organization).toMatchObject({ name: "Example Retail LLC", status: "suspended" });
    const audit = await lastAudit("organization.update");
    expect(audit?.metadata).toMatchObject({ changed: ["name", "status"], status: "suspended", previousStatus: "active" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "organization.update" });

    const hidden = await call(lookup, request("GET", "/"), { slug: "example-retail" });
    expect(hidden.status).toBe(404);
    await call(patch, request("PATCH", "/", { token: admin.token, body: { status: "active" } }), { organizationId });
    const shown = await call(lookup, request("GET", "/", { headers: { "x-forwarded-for": "192.0.2.2" } }), { slug: "example-retail" });
    expect(shown.status).toBe(200);
    expect(shown.body.stores).toHaveLength(1);
  });

  it("answers 409 for an org tag in use and 400 for a bad one or a bad status", async () => {
    const { organization } = await seedOrganization(admin);
    await seedOrganization(admin, { slug: "other-retail", name: "Other" });
    const params = { organizationId: organization.organizationId };
    const taken = await call(patch, request("PATCH", "/", { token: admin.token, body: { slug: "other-retail" } }), params);
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("SLUG_TAKEN");
    for (const body of [{ slug: "Bad Tag" }, { status: "pending" }, { roles: [] }, {}]) {
      expect((await call(patch, request("PATCH", "/", { token: admin.token, body }), params)).status).toBe(400);
    }
    expect((await call(patch, request("PATCH", "/", { token: admin.token, body: { name: "x" } }), { organizationId: "org_nope" })).status).toBe(404);
  });

  it("clears the billing e-mail with null, without notifying stores", async () => {
    const { organization } = await seedOrganization(admin);
    vi.mocked(scheduleNotify).mockClear();
    const res = await call(
      patch,
      request("PATCH", "/", { token: admin.token, body: { billingEmail: null } }),
      { organizationId: organization.organizationId }
    );
    expect(res.status).toBe(200);
    expect(res.body.organization.billingEmail).toBeNull();
    expect(scheduleNotify).not.toHaveBeenCalled();
  });
});

describe("DELETE /organizations/{org}", () => {
  async function twoOrganizations() {
    const a = await seedOrganization(admin);
    const b = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
    await addUser(admin, a.organization.organizationId, {
      mode: "managed",
      email: "only-a@example.invalid",
      password: "password-1",
      assignments: [{ storeId: null, role: "viewer" }]
    });
    for (const org of [a, b]) {
      await addUser(admin, org.organization.organizationId, {
        mode: "managed",
        email: "both@example.invalid",
        password: "password-2",
        assignments: [{ storeId: org.store.storeId, role: "cashier" }]
      });
    }
    const pc = await activatePc(a.organization.organizationId, a.store.storeId);
    return { a, b, pc };
  }

  it("refuses without the org tag typed exactly, and deletes nothing", async () => {
    const { a } = await twoOrganizations();
    const params = { organizationId: a.organization.organizationId };
    const wrong = await call(remove, request("DELETE", "/", { token: admin.token, body: { confirmSlug: "other-retail" } }), params);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe("CONFIRM_SLUG_MISMATCH");
    expect((await call(remove, request("DELETE", "/", { token: admin.token }), params)).status).toBe(400);
    expect(await OrganizationModel.countDocuments()).toBe(2);
    expect(revokeInstallationsAndNotify).not.toHaveBeenCalled();
  });

  it("revokes, then deletes everything under it by id; logins in another organization stay", async () => {
    const { a, b } = await twoOrganizations();
    const organizationId = a.organization.organizationId;
    const res = await call(
      remove,
      request("DELETE", "/", { token: admin.token, body: { confirmSlug: "Example-Retail" } }),
      { organizationId }
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: organizationId, counts: { stores: 1, installations: 1, usersDeleted: 1, usersKept: 1 } });
    expect(revokeInstallationsAndNotify).toHaveBeenCalledWith({ organizationId, reason: "organization.delete" });
    // No tunnel was created (Cloudflare is off); deletion is by stored id only, never by name.
    expect(deleteCloudflareTunnel).not.toHaveBeenCalled();

    for (const model of [TenantStoreModel, LicenseModel, WorkerInstallationModel, WorkerCredentialModel, UserAssignmentModel]) {
      expect(await model.countDocuments({ organizationId })).toBe(0);
    }
    expect(await OrganizationModel.countDocuments({ organizationId })).toBe(0);
    expect(await AppUserModel.countDocuments({ email: "only-a@example.invalid" })).toBe(0);
    const both = await AppUserModel.findOne({ email: "both@example.invalid" }).lean();
    expect(both).toBeTruthy();
    expect(await UserAssignmentModel.countDocuments({ appUserId: both?.appUserId, organizationId: b.organization.organizationId })).toBe(1);
    expect(await TenantStoreModel.countDocuments({ organizationId: b.organization.organizationId })).toBe(1);
    const audit = await lastAudit("organization.delete");
    expect(audit).toMatchObject({ organizationId, actorId: admin.adminId });
    // The history stays.
    expect(await AuditEventModel.countDocuments({ organizationId, action: "organization.create" })).toBe(1);
  });

  it("deletes nothing when the revoke fails", async () => {
    const { a } = await twoOrganizations();
    vi.mocked(revokeInstallationsAndNotify).mockRejectedValueOnce(new Error("database down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call(
      remove,
      request("DELETE", "/", { token: admin.token, body: { confirmSlug: "example-retail" } }),
      { organizationId: a.organization.organizationId }
    );
    quiet.mockRestore();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(await OrganizationModel.countDocuments()).toBe(2);
    expect(await TenantStoreModel.countDocuments()).toBe(2);
    expect(deleteCloudflareTunnel).not.toHaveBeenCalled();
  });
});
