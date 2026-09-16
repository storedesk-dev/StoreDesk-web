import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCloudflareTunnel } from "@/lib/cloudflare";

/**
 * Removing a store's tunnel against a fake Cloudflare API. The case that broke a store (hars.storedesk.net,
 * 2026-09-16): the store PC's cloudflared reconnected as soon as its connections were dropped, Cloudflare refused
 * to delete a tunnel with live connections, and the DNS record was deleted anyway — a healthy tunnel with no
 * hostname, and every phone on error 1033.
 */

type Call = { method: string; path: string };

function fakeCloudflare(options: { tunnelDelete: "ok" | "refused" }) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace("https://api.cloudflare.com/client/v4", "");
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    const isTunnel = /\/cfd_tunnel\/[^/]+$/.test(path) && method === "DELETE";
    if (isTunnel && options.tunnelDelete === "refused") {
      return new Response(JSON.stringify({ success: false, errors: [{ message: "Cannot delete tunnel because it has active connections" }] }), { status: 400 });
    }
    return new Response(JSON.stringify({ success: true, result: {} }), { status: 200 });
  });
  return { calls, fetchMock };
}

describe("deleting a store's tunnel", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "test-token");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", "zone");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("removes the tunnel and then its DNS record", async () => {
    const { calls, fetchMock } = fakeCloudflare({ tunnelDelete: "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteCloudflareTunnel({ tunnelId: "t-1", dnsRecordId: "dns-1" })).resolves.toEqual({ tunnelDeleted: true, dnsDeleted: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "DELETE /accounts/acct/cfd_tunnel/t-1/connections",
      "DELETE /accounts/acct/cfd_tunnel/t-1",
      "DELETE /zones/zone/dns_records/dns-1"
    ]);
  });

  it("keeps the DNS record when Cloudflare refuses to delete a tunnel the store PC reconnected", async () => {
    const { calls, fetchMock } = fakeCloudflare({ tunnelDelete: "refused" });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(deleteCloudflareTunnel({ tunnelId: "t-1", dnsRecordId: "dns-1" })).resolves.toEqual({ tunnelDeleted: false, dnsDeleted: false });
    // The live tunnel keeps its hostname, so the store's phones keep working until an operator cleans it up.
    expect(calls.some((c) => c.path.includes("/dns_records/"))).toBe(false);
  });

  it("does nothing without Cloudflare credentials", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteCloudflareTunnel({ tunnelId: "t-1", dnsRecordId: "dns-1" })).resolves.toEqual({ tunnelDeleted: false, dnsDeleted: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
