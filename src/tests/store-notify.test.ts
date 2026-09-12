import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFY_PATH,
  notifyInstallations,
  runAfterResponse,
  signNotify,
  type NotifyTarget
} from "@/lib/store-notify";

/**
 * The control plane's nudge to a store server. The signature vector below is
 * shared with store-desk-server's notify endpoint tests.
 */

const VECTOR = {
  relayKey: "storedesk-test-relay-key-0123456789abcdef",
  timestamp: "1893456000",
  workerInstallationId: "winst_0123456789abcdef0123456789abcdef",
  // 16 bytes 0x00..0x0f, base64url.
  nonce: "AAECAwQFBgcICQoLDA0ODw",
  signature: "3eb9b9c4a9578df697e358df608328e858ddc801bf6ee3c8b29436184c3b3cd6"
};

const target: NotifyTarget = {
  workerInstallationId: VECTOR.workerInstallationId,
  tunnelUrl: "https://store-42.example.invalid/",
  relayKey: VECTOR.relayKey
};

const fixed = {
  now: () => Number(VECTOR.timestamp) * 1000 + 999,
  nonce: () => VECTOR.nonce
};

afterEach(() => vi.restoreAllMocks());

describe("signNotify", () => {
  it("matches the shared test vector", () => {
    expect(
      signNotify(VECTOR.relayKey, VECTOR.timestamp, VECTOR.workerInstallationId, VECTOR.nonce)
    ).toBe(VECTOR.signature);
  });
});

describe("notifyInstallations", () => {
  it("posts a signed, data-free nudge to each store's tunnel", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    const outcomes = await notifyInstallations(
      { organizationId: "org_1", reason: "role.update" },
      { ...fixed, fetch: fetchMock as unknown as typeof fetch, loadTargets: async () => [target] }
    );

    expect(outcomes).toEqual([{ workerInstallationId: target.workerInstallationId, ok: true, status: 202 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://store-42.example.invalid${NOTIFY_PATH}`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-StoreDesk-Timestamp"]).toBe(VECTOR.timestamp);
    expect(headers["X-StoreDesk-Signature"]).toBe(VECTOR.signature);
    expect(JSON.parse(String(init.body))).toEqual({
      workerInstallationId: VECTOR.workerInstallationId,
      nonce: VECTOR.nonce,
      reason: "role.update"
    });
    expect(String(init.body)).not.toContain(VECTOR.relayKey);
  });

  it("never throws when the targets cannot be loaded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const outcomes = await notifyInstallations(
      { organizationId: "org_1", reason: "role.update" },
      {
        loadTargets: async () => {
          throw new Error("database down");
        }
      }
    );
    expect(outcomes).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("reports a network failure, a refusal and a bad URL without throwing or logging the key", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("down")) throw new TypeError("fetch failed");
      return new Response(null, { status: 401 });
    });
    const outcomes = await notifyInstallations(
      { organizationId: "org_1", reason: "assignment.create" },
      {
        ...fixed,
        fetch: fetchMock as unknown as typeof fetch,
        loadTargets: async () => [
          { ...target, workerInstallationId: "winst_down", tunnelUrl: "https://down.example.invalid" },
          { ...target, workerInstallationId: "winst_refuses" },
          { ...target, workerInstallationId: "winst_bad", tunnelUrl: "not a url" }
        ]
      }
    );
    expect(outcomes).toEqual([
      { workerInstallationId: "winst_down", ok: false, error: "TypeError" },
      { workerInstallationId: "winst_refuses", ok: false, status: 401 },
      { workerInstallationId: "winst_bad", ok: false, error: "INVALID_TUNNEL_URL" }
    ]);
    const logged = warn.mock.calls.flat().join("\n");
    expect(logged).not.toContain(VECTOR.relayKey);
    expect(logged).not.toContain(VECTOR.signature);
  });

  it("gives up on a store that does not answer in time", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
    );
    const outcomes = await notifyInstallations(
      { organizationId: "org_1", reason: "role.update" },
      { ...fixed, timeoutMs: 20, fetch: hang as unknown as typeof fetch, loadTargets: async () => [target] }
    );
    expect(outcomes).toEqual([{ workerInstallationId: target.workerInstallationId, ok: false, error: "TIMEOUT" }]);
  });
});

describe("runAfterResponse", () => {
  it("runs the task outside a request and swallows its failure", async () => {
    const ran = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(() => runAfterResponse(ran)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ran).toHaveBeenCalledTimes(1);
  });
});
