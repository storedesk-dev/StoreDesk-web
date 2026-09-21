import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as list, POST as create } from "@/app/api/v1/admin/organizations/[organizationId]/roles/route";
import { DELETE as remove, PUT as save } from "@/app/api/v1/admin/organizations/[organizationId]/roles/[roleId]/route";
import { addUser } from "@/lib/users";
import { updateRoleFromEdge } from "@/lib/roles";
import { findTemplate } from "@/lib/role-templates";
import { ALL_PAGES } from "@/config/pages";
import { scheduleNotify } from "@/lib/store-notify";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/** Roles: saved one at a time on the version read (P3), templates from the registry (P9, P10). */

setupMemoryMongo();

let admin: TestAdmin;
let organizationId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  organizationId = (await seedOrganization(admin)).organization.organizationId;
});

const cashier = () => findTemplate("cashier")!;

describe("GET …/roles", () => {
  it("lists every role with its version and user count, and the templates", async () => {
    await addUser(admin, organizationId, {
      mode: "managed",
      email: "clerk@example.invalid",
      password: "password-1",
      assignments: [{ storeId: null, role: "cashier" }]
    });
    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    expect(res.status).toBe(200);
    expect(res.body.roles.map((role: { roleId: string }) => role.roleId)).toEqual(["org_admin", "store_manager", "cashier", "viewer"]);
    expect(res.body.roles.find((role: { roleId: string }) => role.roleId === "cashier")).toMatchObject({ version: 1, userCount: 1 });
    expect(res.body.templates.map((template: { templateId: string }) => template.templateId)).toContain("blank");
    expect((await call(list, request("GET", "/"), { organizationId })).status).toBe(401);
  });

  it("every template lists every registry page of each app except retired ones, and no other", async () => {
    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    for (const role of res.body.roles) {
      for (const app of ["electron", "mobile"] as const) {
        const keys = role.accessKeys[app].pages.map((page: { key: string }) => page.key).sort();
        expect(keys).toEqual(ALL_PAGES.filter((page) => page.app === app && !page.retired).map((page) => page.key).sort());
        expect(keys).not.toContain("mobilePos");
      }
    }
  });
});

describe("POST …/roles", () => {
  it("creates a role from a template, derives its id, audits and notifies", async () => {
    const res = await call(create, request("POST", "/", { token: admin.token, body: { roleName: "Shift Lead", template: "store_manager" } }), { organizationId });
    expect(res.status).toBe(201);
    expect(res.body.role).toMatchObject({ roleId: "shift_lead", roleName: "Shift Lead", version: 1, userCount: 0 });
    expect(res.body.role.accessKeys).toEqual(findTemplate("store_manager")!.accessKeys);
    expect(await lastAudit("role.create")).toMatchObject({ targetId: "shift_lead", actorId: admin.adminId });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "role.create" });

    const twin = await call(create, request("POST", "/", { token: admin.token, body: { roleName: "Shift Lead", template: "blank" } }), { organizationId });
    expect(twin.body.role.roleId).toBe("shift_lead_2");
  });

  it("uses the access the editor sends, and 409 for an id in use", async () => {
    const res = await call(
      create,
      request("POST", "/", { token: admin.token, body: { roleName: "Night", roleId: "night", template: "cashier", accessKeys: cashier().accessKeys } }),
      { organizationId }
    );
    expect(res.status).toBe(201);
    expect(res.body.role.accessKeys).toEqual(cashier().accessKeys);
    const taken = await call(create, request("POST", "/", { token: admin.token, body: { roleName: "X", roleId: "night" } }), { organizationId });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("ROLE_EXISTS");
  });

  it.each([
    ["no name", { template: "blank" }],
    ["an unknown template", { roleName: "X", template: "owner" }],
    ["a bad role id", { roleName: "X", roleId: "Has Spaces" }],
    ["a flag that is not a boolean", { roleName: "X", accessKeys: { electron: { pages: [{ key: "pos", enabled: true, featureFlags: { enableRefunds: "yes" } }] } } }]
  ])("answers 400 for %s", async (_label, body) => {
    expect((await call(create, request("POST", "/", { token: admin.token, body }), { organizationId })).status).toBe(400);
  });
});

describe("PUT …/roles/{roleId}", () => {
  const body = (baseVersion: number, roleName = "Front Cashier") => ({ baseVersion, roleName, accessKeys: cashier().accessKeys });

  it("saves on the version read, audits and notifies every store", async () => {
    const res = await call(save, request("PUT", "/", { token: admin.token, body: body(1) }), { organizationId, roleId: "cashier" });
    expect(res.status).toBe(200);
    expect(res.body.role).toMatchObject({ roleId: "cashier", roleName: "Front Cashier", version: 2 });
    expect(res.body).not.toHaveProperty("warnings");
    expect((await lastAudit("role.update"))?.metadata).toMatchObject({ baseVersion: 1, version: 2 });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "role.update" });
  });

  it("answers 409 ROLE_VERSION_CONFLICT with the current role after a store server saved it", async () => {
    await updateRoleFromEdge(organizationId, "cashier", { baseVersion: 1, roleName: "Edited at the store", accessKeys: cashier().accessKeys });
    vi.mocked(scheduleNotify).mockClear();
    const res = await call(save, request("PUT", "/", { token: admin.token, body: body(1) }), { organizationId, roleId: "cashier" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ROLE_VERSION_CONFLICT");
    expect(res.body.role).toMatchObject({ roleName: "Edited at the store", version: 2 });
    expect(scheduleNotify).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown role and 400 for a bad shape", async () => {
    expect((await call(save, request("PUT", "/", { token: admin.token, body: body(1) }), { organizationId, roleId: "nope" })).status).toBe(404);
    const bad = await call(save, request("PUT", "/", { token: admin.token, body: { roleName: "x", accessKeys: {} } }), { organizationId, roleId: "cashier" });
    expect(bad.status).toBe(400);
  });

  it("keeps a page the registry doesn't know, and says so", async () => {
    const accessKeys = { ...cashier().accessKeys, electron: { pages: [...cashier().accessKeys.electron.pages, { key: "oldPage", enabled: true, featureFlags: {} }] } };
    const res = await call(save, request("PUT", "/", { token: admin.token, body: { baseVersion: 1, roleName: "Cashier", accessKeys } }), { organizationId, roleId: "cashier" });
    expect(res.status).toBe(200);
    expect(res.body.warnings).toEqual({ unknownPageKeys: ["electron.oldPage"] });
  });

  it("keeps a retired page a stored role still has, without a warning", async () => {
    const retired = { key: "mobilePos", enabled: true, featureFlags: { enableManualEntry: false, enableQuickSale: true } };
    const accessKeys = { ...cashier().accessKeys, mobile: { pages: [...cashier().accessKeys.mobile.pages, retired] } };
    const res = await call(save, request("PUT", "/", { token: admin.token, body: { baseVersion: 1, roleName: "Cashier", accessKeys } }), { organizationId, roleId: "cashier" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("warnings");
    expect(res.body.role.accessKeys.mobile.pages).toContainEqual(retired);
    const listed = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    const stored = listed.body.roles.find((role: { roleId: string }) => role.roleId === "cashier");
    expect(stored.accessKeys.mobile.pages).toContainEqual(retired);
  });
});

describe("DELETE …/roles/{roleId}", () => {
  it("answers 409 ROLE_IN_USE while a user has it, then deletes, audits and notifies", async () => {
    const added = await addUser(admin, organizationId, {
      mode: "managed",
      email: "viewer@example.invalid",
      password: "password-1",
      assignments: [{ storeId: null, role: "viewer" }]
    });
    const inUse = await call(remove, request("DELETE", "/", { token: admin.token }), { organizationId, roleId: "viewer" });
    expect(inUse.status).toBe(409);
    expect(inUse.body).toMatchObject({ error: { code: "ROLE_IN_USE" }, userCount: 1 });
    expect(added.user.assignments).toHaveLength(1);

    const res = await call(remove, request("DELETE", "/", { token: admin.token }), { organizationId, roleId: "store_manager" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: "store_manager" });
    expect(await lastAudit("role.delete")).toMatchObject({ targetId: "store_manager" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, reason: "role.delete" });
    expect((await call(remove, request("DELETE", "/", { token: admin.token }), { organizationId, roleId: "store_manager" })).status).toBe(404);
  });
});

describe("the Organization Admin role", () => {
  /** A copy stored before Deals and price groups existed: 10 pages per app, no `deals`, no `priceGroups`. */
  async function storeOldAdminRole(version: number) {
    const { OrganizationModel } = await import("@/models/ControlPlane");
    const org = (await OrganizationModel.findOne({ organizationId }).lean()) as { roles: Array<Record<string, unknown>> };
    const old = (app: "electron" | "mobile") =>
      ALL_PAGES.filter((page) => page.app === app && !page.retired && page.key !== "deals" && page.key !== "mobileDeals")
        .slice(0, 10)
        .map((page) => ({ key: page.key, enabled: true, featureFlags: page.key.toLowerCase().includes("pricebook") ? {} : { x: true } }));
    const roles = org.roles.map((role) =>
      role.roleId === "org_admin"
        ? { ...role, version, accessKeys: { electron: { pages: old("electron") }, mobile: { pages: old("mobile") } } }
        : role
    );
    await OrganizationModel.updateOne({ organizationId }, { $set: { roles } });
    return OrganizationModel;
  }

  const every = (app: "electron" | "mobile") => ALL_PAGES.filter((page) => page.app === app && !page.retired);

  it("reads with every registered page and flag, one version up, and stores that so stores re-sync", async () => {
    const OrganizationModel = await storeOldAdminRole(3);
    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    const role = res.body.roles.find((entry: { roleId: string }) => entry.roleId === "org_admin");
    expect(role.version).toBe(4);
    for (const app of ["electron", "mobile"] as const) {
      for (const def of every(app)) {
        const page = role.accessKeys[app].pages.find((entry: { key: string }) => entry.key === def.key);
        expect(page, `${app}.${def.key}`).toMatchObject({ enabled: true });
        for (const flag of Object.keys(def.knownFeatureFlags)) expect(page.featureFlags[flag], `${def.key}.${flag}`).toBe(true);
      }
    }
    expect(role.accessKeys.electron.pages.map((page: { key: string }) => page.key)).toContain("deals");
    expect(role.accessKeys.mobile.pages.find((page: { key: string }) => page.key === "mobilePriceBook").featureFlags.priceGroups).toBe(true);

    // Stored at the version it read at; reading again does not bump it further.
    const stored = (await OrganizationModel.findOne({ organizationId }).lean()) as { roles: Array<{ roleId: string; version: number }> };
    expect(stored.roles.find((entry) => entry.roleId === "org_admin")?.version).toBe(4);
    const again = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    expect(again.body.roles.find((entry: { roleId: string }) => entry.roleId === "org_admin")).toEqual(role);
  });

  it("never grants new pages to another role", async () => {
    const { OrganizationModel } = await import("@/models/ControlPlane");
    const org = (await OrganizationModel.findOne({ organizationId }).lean()) as { roles: Array<Record<string, unknown>> };
    const viewer = findTemplate("viewer")!.accessKeys;
    const withoutDeals = {
      electron: { pages: viewer.electron.pages.filter((page) => page.key !== "deals") },
      mobile: { pages: viewer.mobile.pages.filter((page) => page.key !== "mobileDeals") },
      // A role stored before StoreDesk Lottery existed reads back with an empty block — which is
      // the point of this test: an app being added grants nobody anything.
      lottery: { pages: [] }
    };
    const roles = org.roles.map((role) => (role.roleId === "viewer" ? { ...role, version: 2, accessKeys: withoutDeals } : role));
    await OrganizationModel.updateOne({ organizationId }, { $set: { roles } });

    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    const role = res.body.roles.find((entry: { roleId: string }) => entry.roleId === "viewer");
    expect(role.version).toBe(2);
    expect(role.accessKeys).toEqual(withoutDeals);
  });

  it("keeps every page whatever an edit sends, from the admin or a store", async () => {
    const off = {
      electron: { pages: every("electron").map((page) => ({ key: page.key, enabled: false, featureFlags: {} })) },
      mobile: { pages: [] }
    };
    const res = await call(save, request("PUT", "/", { token: admin.token, body: { baseVersion: 1, roleName: "Owner", accessKeys: off } }), {
      organizationId,
      roleId: "org_admin"
    });
    expect(res.status).toBe(200);
    expect(res.body.role).toMatchObject({ roleName: "Owner", version: 2 });
    expect(res.body.role.accessKeys.electron.pages.every((page: { enabled: boolean }) => page.enabled)).toBe(true);
    expect(res.body.role.accessKeys.mobile.pages).toHaveLength(every("mobile").length);

    const edge = await updateRoleFromEdge(organizationId, "org_admin", { baseVersion: 2, roleName: "Owner", accessKeys: off });
    expect(edge.status).toBe("ok");
    if (edge.status === "ok") {
      expect(edge.role.version).toBe(3);
      expect(edge.role.accessKeys.mobile.pages.map((page) => page.key)).toContain("mobileDeals");
    }
  });
});
