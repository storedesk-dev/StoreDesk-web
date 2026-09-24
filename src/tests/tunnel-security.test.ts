import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  VALID_ACKS,
  VALID_INSTALLATION,
  activatePc,
  call,
  createAdmin,
  lastAudit,
  request,
  seedOrganization,
  type TestAdmin
} from "./helpers/api";
import { GET as getSetup } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup/route";
import { POST as issueKey } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/setup-keys/route";
import { POST as replacePc } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/replace-pc/route";
import { POST as retryTunnel } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/tunnel/route";
import { POST as createStoreRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/route";
import { DELETE as deleteStoreRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { deleteCloudflareTunnel, provisionCloudflareTunnel, rotateCloudflareTunnel } from "@/lib/cloudflare";
import { TenantStoreModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-notify")>();
  return { ...actual, scheduleNotify: vi.fn(), scheduleAppUserNotify: vi.fn(), revokeInstallationsAndNotify: vi.fn(actual.revokeInstallationsAndNotify) };
});
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn(async () => ({ cloudflareToken: "CF_TOKEN_NEW" }))
}));

/**
 * The store tunnel after the security review: Replace PC cuts the old PC off
 * the tunnel (rotated secret) before a new key can be issued; Retry rotates a
 * live tunnel; labels are unique and saved only on success; delete goes by
 * the stored Cloudflare ids, never by name.
 */

setupMemoryMongo();

let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let params: { organizationId: string; storeId: string };

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
});
afterEach(() => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
});

async function giveStoreTunnel(extra: Record<string, unknown> = { tunnelId: "cf-tunnel-1", tunnelDnsRecordId: "dns-1" }) {
  await TenantStoreModel.updateOne(
    { storeId: params.storeId },
    {
      $set: {
        tunnelUrl: "https://example-retail-store-42.tunnels.example",
        tunnelLabel: "example-retail-store-42",
        tunnelStatus: "provisioned",
        cloudflareToken: "CF_TOKEN_OLD",
        ...extra
      }
    }
  );
}

const post = (handler: Parameters<typeof call>[0], body?: unknown) => call(handler, request("POST", "/", { token: admin.token, body }), params);

async function activeStorePc() {
  const pc = await activatePc(params.organizationId, params.storeId);
  return pc;
}

async function storeToken() {
  return (await TenantStoreModel.findOne({ storeId: params.storeId }).select("+cloudflareToken").lean())?.cloudflareToken;
}

describe("Replace PC and the tunnel", () => {
  it("rotates the tunnel secret, so the next PC gets a token the old one never had", async () => {
    await giveStoreTunnel();
    await activeStorePc();
    const replaced = await post(replacePc);
    expect(replaced.status).toBe(200);
    expect(rotateCloudflareTunnel).toHaveBeenCalledWith("cf-tunnel-1");
    expect(replaced.body.tunnel).toMatchObject({ status: "ok", rotationRequired: false });
    expect(await storeToken()).toBe("CF_TOKEN_NEW");
    expect((await lastAudit("installation.replace"))?.metadata).toMatchObject({ tunnelRotated: true });

    const key = await post(issueKey, { deliver: "show" });
    expect(key.status).toBe(201);
    const activated = await call(
      redeem,
      request("POST", "/", { body: { setupKey: key.body.setupKey, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION } })
    );
    expect(activated.status).toBe(201);
    expect(activated.body.cloudflareToken).toBe("CF_TOKEN_NEW");
  });

  it("blocks setup keys until a failed rotation is retried, then Retry rotates the live tunnel", async () => {
    await giveStoreTunnel();
    await activeStorePc();
    vi.mocked(rotateCloudflareTunnel).mockRejectedValueOnce(new Error("Cloudflare is down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const replaced = await post(replacePc);
    quiet.mockRestore();
    expect(replaced.status).toBe(200);
    expect(replaced.body.tunnel.rotationRequired).toBe(true);
    expect(await storeToken()).toBe("CF_TOKEN_OLD");

    const setup = await call(getSetup, request("GET", "/", { token: admin.token }), params);
    expect(setup.body.keyBlockedCode).toBe("TUNNEL_ROTATION_REQUIRED");
    const blocked = await post(issueKey, { deliver: "show" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("TUNNEL_ROTATION_REQUIRED");

    const rotated = await post(retryTunnel);
    expect(rotated.status).toBe(200);
    expect(rotated.body.tunnel).toMatchObject({ status: "ok", rotationRequired: false });
    expect((await lastAudit("store.tunnel.rotate"))?.metadata).toMatchObject({ afterReplacePc: true, status: "ok", tunnelId: "cf-tunnel-1" });
    expect(await storeToken()).toBe("CF_TOKEN_NEW");
    expect((await post(issueKey, { deliver: "show" })).status).toBe(201);
  });

  it("an older tunnel known only by name must be replaced: a new tunnel under a new name, the old one named for cleanup", async () => {
    await giveStoreTunnel({});
    await activeStorePc();
    const replaced = await post(replacePc);
    expect(replaced.body.tunnel.rotationRequired).toBe(true);
    expect(rotateCloudflareTunnel).not.toHaveBeenCalled();

    vi.mocked(provisionCloudflareTunnel).mockResolvedValueOnce({
      cloudflareToken: "CF_TOKEN_REPLACEMENT",
      tunnelUrl: "https://example-retail-store-42-2.tunnels.example",
      tunnelId: "cf-tunnel-2",
      dnsRecordId: "dns-2"
    });
    const retried = await post(retryTunnel);
    expect(retried.status).toBe(200);
    expect(vi.mocked(provisionCloudflareTunnel).mock.calls[0][1]).toBe("example-retail-store-42-2");
    expect((await lastAudit("store.tunnel.provision"))?.metadata).toMatchObject({ replacedLegacyTunnel: "example-retail-store-42" });
    const store = await TenantStoreModel.findOne({ storeId: params.storeId }).lean();
    expect(store).toMatchObject({ tunnelId: "cf-tunnel-2", tunnelDnsRecordId: "dns-2", tunnelLabel: "example-retail-store-42-2" });
    expect(store?.tunnelRotationRequired).toBeUndefined();
    expect((await post(issueKey, { deliver: "show" })).status).toBe(201);
  });

  it("marks the tunnel for rotation when Cloudflare is not configured here", async () => {
    await giveStoreTunnel();
    await activeStorePc();
    delete process.env.CLOUDFLARE_API_TOKEN;
    const replaced = await post(replacePc);
    expect(replaced.body.tunnel.rotationRequired).toBe(true);
    expect((await post(issueKey, { deliver: "show" })).body.error.code).toBe("TUNNEL_ROTATION_REQUIRED");
  });

  it("a store without a tunnel needs no rotation", async () => {
    await activeStorePc();
    const replaced = await post(replacePc);
    expect(replaced.body.tunnel.rotationRequired).toBe(false);
    expect((await lastAudit("installation.replace"))?.metadata).toMatchObject({ tunnelRotated: false });
  });
});

describe("tunnel labels", () => {
  const created = (storeId: string, label: string) => ({
    cloudflareToken: `t-${storeId}`,
    tunnelUrl: `https://${label}.tunnels.example`,
    tunnelId: `id-${label}`,
    dnsRecordId: `dns-${label}`
  });

  it("gives a second store with the same name a -2 label, and refuses an explicit label in use", async () => {
    vi.mocked(provisionCloudflareTunnel).mockImplementation(async (storeId: string, label: string) => created(storeId, label));
    const first = await call(createStoreRoute, request("POST", "/", { token: admin.token, body: { name: "Main St" } }), params);
    const second = await call(createStoreRoute, request("POST", "/", { token: admin.token, body: { name: "Main St" } }), params);
    expect(first.body.store.tunnel.label).toBe("main-st");
    expect(second.body.store.tunnel.label).toBe("main-st-2");
    const taken = await call(
      createStoreRoute,
      request("POST", "/", { token: admin.token, body: { name: "Other", tunnelLabel: "main-st" } }),
      params
    );
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe("TUNNEL_LABEL_TAKEN");
  });

  it("does not save the label of a failed attempt, so it stays free", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(provisionCloudflareTunnel).mockRejectedValueOnce(new Error("quota"));
    const failed = await call(createStoreRoute, request("POST", "/", { token: admin.token, body: { name: "Elm Ave" } }), params);
    quiet.mockRestore();
    expect(failed.body.tunnel.status).toBe("failed");
    expect((await TenantStoreModel.findOne({ storeId: failed.body.store.storeId }).lean())?.tunnelLabel).toBeUndefined();
    vi.mocked(provisionCloudflareTunnel).mockImplementation(async (storeId: string, label: string) => created(storeId, label));
    const next = await call(createStoreRoute, request("POST", "/", { token: admin.token, body: { name: "Elm Ave" } }), params);
    expect(next.body.store.tunnel.label).toBe("elm-ave");
  });
});

describe("deleting a store's tunnel", () => {
  it("deletes by the stored tunnel and DNS record ids", async () => {
    await giveStoreTunnel();
    const res = await call(deleteStoreRoute, request("DELETE", "/", { token: admin.token }), params);
    expect(res.status).toBe(200);
    expect(deleteCloudflareTunnel).toHaveBeenCalledWith({ tunnelId: "cf-tunnel-1", dnsRecordId: "dns-1" });
    expect((await lastAudit("store.delete"))?.metadata).toMatchObject({ tunnelDeleted: true });
  });

  it("never deletes by name: an older tunnel is left and named for manual cleanup", async () => {
    await giveStoreTunnel({});
    const res = await call(deleteStoreRoute, request("DELETE", "/", { token: admin.token }), params);
    expect(res.status).toBe(200);
    expect(res.body.tunnelNeedsManualCleanup).toBe("example-retail-store-42");
    expect(deleteCloudflareTunnel).not.toHaveBeenCalled();
    expect((await lastAudit("store.delete"))?.metadata).toMatchObject({ tunnelNeedsManualCleanup: "example-retail-store-42" });
  });
});
