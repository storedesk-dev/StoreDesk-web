import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting an organization or a store revokes its worker credentials and
 * notifies its store servers before anything is deleted — including the
 * tunnel the notify travels through. A failed revoke stops the delete.
 */

const h = vi.hoisted(() => ({ log: [] as string[], revokeFails: false }));

vi.mock("@/lib/admin-auth", () => ({
  requireInternalAdmin: vi.fn(async () => ({ adminId: "adm_1", email: "support@example.invalid" }))
}));

vi.mock("@/lib/cloudflare", () => ({
  deleteCloudflareTunnel: vi.fn(async (slug: string) => {
    h.log.push(`tunnel:${slug}`);
  })
}));

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  revokeInstallationsAndNotify: vi.fn(async (input: { reason: string; storeId?: string }) => {
    if (h.revokeFails) throw new Error("database down");
    h.log.push(`revoke:${input.reason}:${input.storeId ?? "*"}`);
    return { revoked: 1, outcomes: [] };
  })
}));

vi.mock("@/models/ControlPlane", () => {
  const record = { organizationId: "org_1", storeId: "store_1", tunnelUrl: "https://store-42.example.invalid" };
  const recorder = (name: string) => ({
    findOne: vi.fn(async () => record),
    find: vi.fn(async () => [record]),
    deleteMany: vi.fn(async () => {
      h.log.push(`delete:${name}`);
    }),
    deleteOne: vi.fn(async () => {
      h.log.push(`delete:${name}`);
    })
  });
  return {
    OrganizationModel: recorder("organization"),
    TenantStoreModel: recorder("store"),
    SubscriptionModel: recorder("subscription"),
    WorkerInstallationModel: recorder("installation"),
    SetupKeyModel: recorder("setupKey"),
    AppUserModel: recorder("appUser")
  };
});

import { DELETE as deleteOrganization } from "@/app/api/v1/admin/organizations/[organizationId]/route";
import { DELETE as deleteStore } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/route";
import { revokeInstallationsAndNotify } from "@/lib/store-notify";

beforeEach(() => {
  h.log = [];
  h.revokeFails = false;
  vi.mocked(revokeInstallationsAndNotify).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function organizationDelete() {
  return deleteOrganization(new Request("http://localhost/api/v1/admin/organizations/org_1", { method: "DELETE" }), {
    params: Promise.resolve({ organizationId: "org_1" })
  });
}

function storeDelete() {
  return deleteStore(
    new Request("http://localhost/api/v1/admin/organizations/org_1/stores/store_1", { method: "DELETE" }),
    { params: Promise.resolve({ organizationId: "org_1", storeId: "store_1" }) }
  );
}

describe("DELETE an organization", () => {
  it("revokes and notifies every installation before deleting anything", async () => {
    const res = await organizationDelete();
    expect(res.status).toBe(200);
    expect(revokeInstallationsAndNotify).toHaveBeenCalledWith({
      organizationId: "org_1",
      reason: "organization.delete"
    });
    expect(h.log[0]).toBe("revoke:organization.delete:*");
    expect(h.log).toContain("tunnel:store-42");
    expect(h.log).toContain("delete:installation");
  });

  it("deletes nothing when the revoke fails", async () => {
    h.revokeFails = true;
    const res = await organizationDelete();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(h.log).toEqual([]);
  });
});

describe("DELETE a store", () => {
  it("revokes and notifies the store's installations before deleting anything", async () => {
    const res = await storeDelete();
    expect(res.status).toBe(200);
    expect(revokeInstallationsAndNotify).toHaveBeenCalledWith({
      organizationId: "org_1",
      storeId: "store_1",
      reason: "store.delete"
    });
    expect(h.log[0]).toBe("revoke:store.delete:store_1");
    expect(h.log).toContain("delete:installation");
  });

  it("deletes nothing when the revoke fails", async () => {
    h.revokeFails = true;
    const res = await storeDelete();
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(h.log).toEqual([]);
  });
});
