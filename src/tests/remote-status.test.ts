import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as lookup } from "@/app/api/v1/app-auth/organizations/[slug]/route";
import { GET as setupRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup/route";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";
import { createStore } from "@/lib/tenant-stores";
import {
  REMOTE_STUB_ENV,
  mapCloudflareTunnelStatus,
  minuteIso,
  remoteStatusOf,
  remoteStatuses,
  resetRemoteStatusCacheForTests
} from "@/lib/remote-status";
import { TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));

/**
 * Remote reachability per store: Cloudflare's tunnel status (mapped, cached,
 * timed out to unknown), the heartbeat fallback, `since`, the dev stub, and
 * where it shows — the phone's org-tag lookup, the setup view, the dashboard.
 */

setupMemoryMongo();

const MINUTE = 60_000;
let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let tunnels: Record<string, Record<string, unknown> | "hang">;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const match = /\/cfd_tunnel\/([^/?]+)$/.exec(String(url));
  if (!match) throw new Error(`unexpected fetch ${url}`);
  const tunnel = tunnels[decodeURIComponent(match[1])];
  if (tunnel === "hang") {
    return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
  }
  if (!tunnel) return new Response(JSON.stringify({ success: false, errors: [{ message: "not found" }] }), { status: 404 });
  return new Response(JSON.stringify({ success: true, result: tunnel }), { status: 200 });
});

beforeEach(async () => {
  vi.clearAllMocks();
  resetRemoteStatusCacheForTests();
  resetRateLimitsForTests();
  tunnels = {};
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function useCloudflare() {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
  vi.stubGlobal("fetch", fetchMock);
}

async function giveTunnel(storeId: string, tunnelId: string) {
  await TenantStoreModel.updateOne(
    { storeId },
    { $set: { tunnelId, tunnelUrl: `https://${tunnelId}.tunnels.example`, tunnelStatus: "provisioned" } }
  );
  return (await TenantStoreModel.findOne({ storeId }).lean()) as Record<string, unknown>;
}

describe("mapping and rounding", () => {
  it.each([
    ["healthy", "online"],
    ["degraded", "online"],
    ["down", "offline"],
    ["inactive", "offline"],
    ["HEALTHY", "online"],
    ["", "unknown"],
    [undefined, "unknown"],
    ["weird", "unknown"]
  ])("Cloudflare %j → %s", (status, expected) => {
    expect(mapCloudflareTunnelStatus(status)).toBe(expected);
  });

  it("rounds since down to the minute", () => {
    expect(minuteIso("2026-09-12T20:14:59.999Z")).toBe("2026-09-12T20:14:00.000Z");
    expect(minuteIso(null)).toBeNull();
    expect(minuteIso("not a date")).toBeNull();
  });
});

describe("from Cloudflare", () => {
  it("uses the tunnel's status and Cloudflare's timestamps", async () => {
    useCloudflare();
    const store = await giveTunnel(seeded.store.storeId, "cf-down");
    tunnels["cf-down"] = { status: "down", conns_inactive_at: "2026-09-12T20:14:37.123Z" };
    expect(await remoteStatusOf(store)).toEqual({ status: "offline", since: "2026-09-12T20:14:00.000Z" });
    resetRemoteStatusCacheForTests();
    tunnels["cf-down"] = { status: "healthy", conns_active_at: "2026-09-12T21:00:05Z", connections: [{ opened_at: "2026-09-12T20:59:00Z" }] };
    expect(await remoteStatusOf(store)).toEqual({ status: "online", since: "2026-09-12T21:00:00.000Z" });
  });

  it("gives Cloudflare 1.5 s, then answers unknown", async () => {
    useCloudflare();
    const store = await giveTunnel(seeded.store.storeId, "cf-slow");
    tunnels["cf-slow"] = "hang";
    const started = Date.now();
    expect(await remoteStatusOf(store)).toEqual({ status: "unknown", since: null });
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(1_400);
    expect(took).toBeLessThan(2_500);
  });

  it("an error from Cloudflare reads as unknown", async () => {
    useCloudflare();
    const store = await giveTunnel(seeded.store.storeId, "cf-missing");
    expect(await remoteStatusOf(store)).toEqual({ status: "unknown", since: null });
  });

  it("caches each tunnel for 60 s", async () => {
    useCloudflare();
    const store = await giveTunnel(seeded.store.storeId, "cf-cached");
    tunnels["cf-cached"] = { status: "healthy" };
    await remoteStatusOf(store);
    await remoteStatusOf(store);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 61_000);
    await remoteStatusOf(store);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("without Cloudflare timestamps, since is when the status was first observed, kept on the store", async () => {
    useCloudflare();
    let store = await giveTunnel(seeded.store.storeId, "cf-plain");
    tunnels["cf-plain"] = { status: "down" };
    const first = await remoteStatusOf(store);
    expect(first.status).toBe("offline");
    expect(first.since).toBe(minuteIso(new Date()));
    store = (await TenantStoreModel.findOne({ storeId: seeded.store.storeId }).lean()) as Record<string, unknown>;
    expect(store).toMatchObject({ remoteStatus: "offline" });

    // Still down later: the first observation stands.
    const earlier = new Date(Date.now() - 45 * MINUTE);
    await TenantStoreModel.updateOne({ storeId: seeded.store.storeId }, { $set: { remoteStatusSince: earlier } });
    store = (await TenantStoreModel.findOne({ storeId: seeded.store.storeId }).lean()) as Record<string, unknown>;
    resetRemoteStatusCacheForTests();
    expect((await remoteStatusOf(store)).since).toBe(minuteIso(earlier));
  });
});

describe("without Cloudflare", () => {
  it("online when the PC checked in within 10 minutes, else unknown; never offline", async () => {
    const store = (await TenantStoreModel.findOne({ storeId: seeded.store.storeId }).lean()) as Record<string, unknown>;
    expect(await remoteStatusOf(store)).toEqual({ status: "unknown", since: null });
    const pc = await activatePc(seeded.organization.organizationId, seeded.store.storeId);
    await WorkerInstallationModel.updateOne({ workerInstallationId: pc.workerInstallationId }, { $set: { lastSeenAt: new Date() } });
    expect((await remoteStatusOf(store)).status).toBe("online");
    await WorkerInstallationModel.updateOne({ workerInstallationId: pc.workerInstallationId }, { $set: { lastSeenAt: new Date(Date.now() - 11 * MINUTE) } });
    const fresh = (await TenantStoreModel.findOne({ storeId: seeded.store.storeId }).lean()) as Record<string, unknown>;
    expect(await remoteStatusOf(fresh)).toEqual({ status: "unknown", since: null });
  });

  it("dev stub: fixed answers per store, never in production", async () => {
    const since = new Date(Date.now() - 30 * MINUTE).toISOString();
    vi.stubEnv(REMOTE_STUB_ENV, JSON.stringify({ [seeded.store.storeId]: { status: "offline", since }, "*": { status: "online" } }));
    const { store: other } = await createStore(admin, seeded.organization.organizationId, { name: "Store 17" });
    const stores = (await TenantStoreModel.find({}).lean()) as Record<string, unknown>[];
    const statuses = await remoteStatuses(stores);
    expect(statuses.get(seeded.store.storeId)).toEqual({ status: "offline", since: minuteIso(since) });
    expect(statuses.get(other.storeId)?.status).toBe("online");
    vi.stubEnv("NODE_ENV", "production");
    expect((await remoteStatuses(stores)).get(seeded.store.storeId)?.status).toBe("unknown");
  });
});

describe("where it shows", () => {
  it("the org-tag lookup: each store gains remote, offline stores stay listed, nothing else about the PC", async () => {
    useCloudflare();
    await giveTunnel(seeded.store.storeId, "cf-lookup-down");
    tunnels["cf-lookup-down"] = { status: "inactive", conns_inactive_at: "2026-09-12T20:14:37Z" };
    await TenantStoreModel.updateOne(
      { storeId: seeded.store.storeId },
      { $set: { configJson: JSON.stringify({ posIntegration: "verifone_commander", posIpAddress: "192.168.1.50", posUsername: "manager" }) } }
    );
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    const { store: noTunnel } = await createStore(admin, seeded.organization.organizationId, { name: "Store 90" });
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "cf-token");

    const res = await call(lookup, request("GET", "/", { headers: { "x-forwarded-for": "192.0.2.50" } }), { slug: "example-retail" });
    expect(res.status).toBe(200);
    expect(res.body.stores).toEqual([
      {
        storeId: seeded.store.storeId,
        name: "Store 42",
        storeNumber: "42",
        tunnelUrl: "https://cf-lookup-down.tunnels.example",
        setup: expect.stringMatching(/^(active|awaiting_activation|none)$/),
        // For the lottery app's store picker: states and a date, never a PC name or a licence number.
        lottery: { hasLottery: false, appEnabled: false, pc: null },
        licence: { covered: true, status: "active" },
        remote: { status: "offline", since: "2026-09-12T20:14:00.000Z" }
      },
      {
        // Created with no license of its own, so it is not covered: Store 42's does not reach it.
        storeId: noTunnel.storeId,
        name: "Store 90",
        storeNumber: null,
        tunnelUrl: null,
        setup: "none",
        lottery: { hasLottery: false, appEnabled: false, pc: null },
        licence: { covered: false, status: null },
        remote: { status: "unknown", since: null }
      }
    ]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("192.168.");
    expect(text).not.toContain("cf-lookup-down\"");
    expect(text).not.toContain("lastSeenAt");
  });

  it("the lookup stays fast and answers when Cloudflare hangs", async () => {
    useCloudflare();
    await giveTunnel(seeded.store.storeId, "cf-hang");
    tunnels["cf-hang"] = "hang";
    const started = Date.now();
    const res = await call(lookup, request("GET", "/", { headers: { "x-forwarded-for": "192.0.2.51" } }), { slug: "example-retail" });
    expect(Date.now() - started).toBeLessThan(2_500);
    expect(res.status).toBe(200);
    expect(res.body.stores[0].remote).toEqual({ status: "unknown", since: null });
  });

  it("the store's setup view and the dashboard (down for more than 15 minutes)", async () => {
    useCloudflare();
    await giveTunnel(seeded.store.storeId, "cf-dash");
    const since = new Date(Date.now() - 30 * MINUTE).toISOString();
    tunnels["cf-dash"] = { status: "down", conns_inactive_at: since };
    const setup = await call(setupRoute, request("GET", "/", { token: admin.token }), {
      organizationId: seeded.organization.organizationId,
      storeId: seeded.store.storeId
    });
    expect(setup.body.remote).toEqual({ status: "offline", since: minuteIso(since) });

    const dash = await call(dashboardRoute, request("GET", "/", { token: admin.token }));
    expect(dash.body.attention).toContainEqual(
      expect.objectContaining({ kind: "tunnel_down", storeId: seeded.store.storeId, at: minuteIso(since) })
    );

    resetRemoteStatusCacheForTests();
    tunnels["cf-dash"] = { status: "down", conns_inactive_at: new Date(Date.now() - 5 * MINUTE).toISOString() };
    const recent = await call(dashboardRoute, request("GET", "/", { token: admin.token }));
    expect(recent.body.attention.map((item: { kind: string }) => item.kind)).not.toContain("tunnel_down");
  });
});
