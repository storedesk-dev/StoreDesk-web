import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as configRoute } from "@/app/api/v1/edge/sync/config/route";
import { POST as retryTunnelRoute } from "@/app/api/v1/admin/stores/[storeId]/tunnel/route";
import { deleteCloudflareTunnel, rotateCloudflareTunnel } from "@/lib/cloudflare";
import { scheduleNotify } from "@/lib/store-notify";
import { edgeTunnelState, removeStoreTunnel } from "@/lib/tunnel";
import { TenantStoreModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn(async () => ({ cloudflareToken: "CF_ROTATED" }))
}));

/**
 * The store server's view of its tunnel in the config sync: `tunnel.state`
 * active | deleted | none, the token only while active, and the notify that
 * makes it sync at once when the tunnel is rotated or deleted.
 */

setupMemoryMongo();

let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let pc: Awaited<ReturnType<typeof activatePc>>;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  pc = await activatePc(seeded.organization.organizationId, seeded.store.storeId);
});
afterEach(() => vi.unstubAllEnvs());

const config = () => call(configRoute, request("GET", "/api/v1/edge/sync/config", { headers: { Authorization: `Bearer ${pc.token}` } }));

async function withTunnel(extra: Record<string, unknown> = {}) {
  await TenantStoreModel.updateOne(
    { storeId: seeded.store.storeId },
    { $set: { tunnelUrl: "https://s42.tunnels.example", cloudflareToken: "CF_1", tunnelId: "cf-1", tunnelStatus: "provisioned", ...extra } }
  );
}

describe("tunnel state in the config sync", () => {
  it("active: the token and URL", async () => {
    await withTunnel();
    const res = await config();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      tunnel: { state: "active", url: "https://s42.tunnels.example" },
      cloudflareToken: "CF_1",
      tunnelUrl: "https://s42.tunnels.example"
    });
  });

  it("none: never had a tunnel, or it could not be provisioned", async () => {
    expect((await config()).body).toMatchObject({ tunnel: { state: "none", url: null }, cloudflareToken: null, tunnelUrl: null });
    await TenantStoreModel.updateOne({ storeId: seeded.store.storeId }, { $set: { tunnelStatus: "failed", tunnelError: "quota" } });
    expect((await config()).body.tunnel.state).toBe("none");
  });

  it("deleted: removing the tunnel clears it on the store, the sync says deleted, and the store is notified", async () => {
    await withTunnel();
    const store = (await TenantStoreModel.findOne({ storeId: seeded.store.storeId }).lean()) as Record<string, unknown>;
    expect(await removeStoreTunnel(store)).toEqual({ tunnelDeleted: true, manualCleanup: null });
    expect(deleteCloudflareTunnel).toHaveBeenCalledWith({ tunnelId: "cf-1", dnsRecordId: null });
    expect(scheduleNotify).toHaveBeenCalledWith({
      organizationId: seeded.organization.organizationId,
      storeId: seeded.store.storeId,
      reason: "tunnel.delete"
    });
    const res = await config();
    expect(res.body).toMatchObject({ tunnel: { state: "deleted", url: null }, cloudflareToken: null, tunnelUrl: null });
    expect(JSON.stringify(res.body)).not.toContain("CF_1");
  });

  it("a token left without its tunnel is never sent", () => {
    expect(edgeTunnelState({ cloudflareToken: "CF_1", tunnelId: "cf-1" })).toBe("deleted");
    expect(edgeTunnelState({ tunnelUrl: "https://x.example" })).toBe("none");
    expect(edgeTunnelState({ tunnelDeletedAt: new Date() })).toBe("deleted");
  });
});

describe("rotating notifies the store to sync at once", () => {
  it("Retry on a live tunnel rotates it and notifies tunnel.rotate; the sync hands out the new token", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    await withTunnel();
    const res = await call(retryTunnelRoute, request("POST", "/", { token: admin.token }), {
      organizationId: seeded.organization.organizationId,
      storeId: seeded.store.storeId
    });
    expect(res.status).toBe(200);
    expect(rotateCloudflareTunnel).toHaveBeenCalledWith("cf-1");
    expect(scheduleNotify).toHaveBeenCalledWith({
      organizationId: seeded.organization.organizationId,
      storeId: seeded.store.storeId,
      reason: "tunnel.rotate"
    });
    expect((await config()).body).toMatchObject({ tunnel: { state: "active" }, cloudflareToken: "CF_ROTATED" });
  });
});
