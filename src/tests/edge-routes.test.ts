import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two edge routes with the worker already authenticated and the database
 * replaced by fixtures: what the access pull selects and returns, and the role
 * update's 200 / 409 / 404 / 400 answers and its notify.
 */

const h = vi.hoisted(() => {
  const HASH = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA";
  const state = {
    selects: [] as string[],
    assignmentFilter: undefined as unknown,
    audits: [] as Array<Record<string, unknown>>,
    users: [] as Array<Record<string, unknown>>,
    assignments: [] as Array<Record<string, unknown>>
  };
  const query = (data: () => unknown) => {
    const chain = {
      select(fields: string) {
        state.selects.push(fields);
        return chain;
      },
      lean: async () => data()
    };
    return chain;
  };
  return { HASH, state, query };
});

vi.mock("@/lib/admin-auth", () => ({
  authenticateWorker: vi.fn(async () => ({
    organizationId: "org_1",
    storeId: "store_1",
    workerInstallationId: "winst_1",
    credentialId: "wcred_1"
  }))
}));

vi.mock("@/models/ControlPlane", () => {
  const none = () => h.query(() => null);
  const many = () => h.query(() => []);
  const model = { findOne: none, find: many };
  return {
    OrganizationModel: {
      findOne: () =>
        h.query(() => ({
          organizationId: "org_1",
          slug: "example-retail",
          name: "Example Retail",
          status: "active",
          roles: [],
          licensing: { mode: "master" },
          createdAt: new Date("2030-01-01T00:00:00Z")
        }))
    },
    TenantStoreModel: {
      findOne: () =>
        h.query(() => ({ organizationId: "org_1", storeId: "store_1", name: "Store 42", status: "active", tunnelUrl: "https://s.example.invalid" }))
    },
    WorkerInstallationModel: {
      findOne: () => h.query(() => ({ workerInstallationId: "winst_1", subscriptionId: "sub_1" })),
      find: many
    },
    LicenseModel: {
      // The master license, found by its coverage key.
      find: () =>
        h.query(() => [
          {
            licenseId: "lic_1",
            licenseNumber: "SD-ORG-7K3Q92",
            organizationId: "org_1",
            scope: "organization",
            status: "trialing",
            entitlementExpiresAt: new Date("2030-02-01T00:00:00Z"),
            offlineGraceDays: 5,
            coverageKey: "org:org_1"
          }
        ])
    },
    UserAssignmentModel: {
      find: (filter: unknown) => {
        h.state.assignmentFilter = filter;
        return h.query(() => h.state.assignments);
      }
    },
    AppUserModel: { find: () => h.query(() => h.state.users) },
    AuditEventModel: {
      create: vi.fn(async (doc: Record<string, unknown>) => {
        h.state.audits.push(doc);
      })
    },
    InternalAdminModel: model,
    AdminSessionModel: model,
    WorkerCredentialModel: model,
    SetupKeyModel: model,
    EulaAcceptanceModel: model,
    ClientDeviceModel: model,
    ClientRefreshCredentialModel: model,
    ClientSessionModel: model,
    RotationChallengeModel: model
  };
});

vi.mock("@/lib/roles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/roles")>()),
  updateRoleFromEdge: vi.fn()
}));

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn()
}));

import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { PUT as updateRole } from "@/app/api/v1/edge/roles/[roleId]/route";
import { updateRoleFromEdge } from "@/lib/roles";
import { scheduleNotify } from "@/lib/store-notify";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";

const role = {
  roleId: "cashier",
  roleName: "Cashier",
  version: 4,
  updatedAt: "2030-01-02T00:00:00.000Z",
  accessKeys: { electron: { pages: [] }, mobile: { pages: [] } }
};

function put(body: unknown, roleId = "cashier") {
  return updateRole(
    new Request(`http://localhost/api/v1/edge/roles/${roleId}`, {
      method: "PUT",
      headers: { Authorization: "Bearer wcred_1.secret", "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body)
    }),
    { params: Promise.resolve({ roleId }) }
  );
}

const validUpdate = {
  baseVersion: 3,
  roleName: "Cashier",
  accessKeys: { electron: { pages: [{ key: "pos", enabled: true, featureFlags: {} }] } }
};

beforeEach(() => {
  resetRateLimitsForTests();
  h.state.selects = [];
  h.state.audits = [];
  h.state.users = [
    { appUserId: "appu_1", email: "owner@example.invalid", status: "active", passwordHash: h.HASH },
    { appUserId: "appu_2", email: "new@example.invalid", status: "pending_enrollment" }
  ];
  h.state.assignments = [
    { assignmentId: "asg_1", appUserId: "appu_1", organizationId: "org_1", storeId: "store_1", workerInstallationId: "winst_1", role: "org_admin", scopes: ["relay:request"], status: "active" },
    { assignmentId: "asg_2", appUserId: "appu_2", organizationId: "org_1", role: "cashier", scopes: ["relay:request"], status: "active" }
  ];
  vi.mocked(updateRoleFromEdge).mockReset();
  vi.mocked(scheduleNotify).mockReset();
});

describe("GET /api/v1/edge/sync/access", () => {
  it("returns this installation's users with hashes, selected explicitly", async () => {
    const res = await accessSync(new Request("http://localhost/api/v1/edge/sync/access"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = await res.json();

    expect(h.state.selects).toContain("+passwordHash");
    // Scoped to the credential's organization and installation, never the request.
    expect(JSON.stringify(h.state.assignmentFilter)).toContain("org_1");
    expect(JSON.stringify(h.state.assignmentFilter)).toContain("winst_1");

    // The store's covering license, under the contract's name.
    expect(body.subscription).toEqual({
      status: "trialing",
      entitlementExpiresAt: "2030-02-01T00:00:00.000Z",
      offlineGraceDays: 5,
      licenseNumber: "SD-ORG-7K3Q92",
      scope: "organization"
    });
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toMatchObject({ appUserId: "appu_1", passwordHash: h.HASH, assignment: { assignmentId: "asg_1", role: "org_admin" } });
    expect(body.users[1]).not.toHaveProperty("passwordHash");
    expect(body.roles[0]).toMatchObject({ roleId: "org_admin", version: 1 });
  });

  it("audits the pull without a hash in the metadata", async () => {
    await accessSync(new Request("http://localhost/api/v1/edge/sync/access"));
    expect(h.state.audits).toHaveLength(1);
    expect(h.state.audits[0]).toMatchObject({ action: "edge.access_sync", actorType: "worker", workerInstallationId: "winst_1" });
    expect(JSON.stringify(h.state.audits[0])).not.toContain(h.HASH);
    expect(h.state.audits[0].metadata).toMatchObject({ users: 2 });
  });

  it("rate-limits one installation after 30 pulls a minute", async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await accessSync(new Request("http://localhost/api/v1/edge/sync/access"))).status).toBe(200);
    }
    expect((await accessSync(new Request("http://localhost/api/v1/edge/sync/access"))).status).toBe(429);
  });
});

describe("PUT /api/v1/edge/roles/{roleId}", () => {
  it("saves on the stored version, audits, and notifies the other installations", async () => {
    vi.mocked(updateRoleFromEdge).mockResolvedValue({ status: "ok", role });
    const res = await put(validUpdate);
    expect(res.status).toBe(200);
    expect((await res.json()).role).toEqual(role);
    expect(vi.mocked(updateRoleFromEdge).mock.calls[0][0]).toBe("org_1");
    expect(vi.mocked(updateRoleFromEdge).mock.calls[0][1]).toBe("cashier");
    expect(h.state.audits[0]).toMatchObject({ action: "role.update", actorType: "worker", actorId: "winst_1", targetId: "cashier" });
    expect(scheduleNotify).toHaveBeenCalledWith({
      organizationId: "org_1",
      exceptInstallationId: "winst_1",
      reason: "role.update"
    });
  });

  it("answers 409 with the current role when the base version is stale", async () => {
    vi.mocked(updateRoleFromEdge).mockResolvedValue({ status: "conflict", role });
    const res = await put(validUpdate);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ROLE_VERSION_CONFLICT");
    expect(body.role).toEqual(role);
    expect(scheduleNotify).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown role", async () => {
    vi.mocked(updateRoleFromEdge).mockResolvedValue({ status: "not_found" });
    const res = await put(validUpdate, "nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("ROLE_NOT_FOUND");
  });

  it.each([
    ["a flag that is not a boolean", { ...validUpdate, accessKeys: { electron: { pages: [{ key: "pos", enabled: true, featureFlags: { a: 1 } }] } } }],
    ["no baseVersion", { roleName: "Cashier", accessKeys: {} }],
    ["a body that is not JSON", "{"]
  ])("answers 400 for %s without touching the roles", async (_label, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("REQUEST_INVALID");
    expect(updateRoleFromEdge).not.toHaveBeenCalled();
  });
});
