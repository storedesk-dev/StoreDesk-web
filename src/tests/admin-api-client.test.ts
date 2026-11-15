import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/app/admin/_lib/api";

/**
 * The admin console's client must call routes that exist. The roles client
 * once called `/organizations/{id}/roles` after roles moved to the store
 * (D-22), and both the Roles and the Users tab failed to load.
 */

const APP = path.resolve(__dirname, "../app");

/** The route file a URL lands on, literal segments first, then a `[param]` folder. */
function routeFile(url: string): string | null {
  let dir = APP;
  for (const segment of new URL(url, "http://localhost").pathname.split("/").filter(Boolean)) {
    const literal = path.join(dir, segment);
    if (existsSync(literal)) {
      dir = literal;
      continue;
    }
    const param = readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory() && /^\[[^.\]]+\]$/.test(e.name));
    if (!param) return null;
    dir = path.join(dir, param.name);
  }
  const file = path.join(dir, "route.ts");
  return existsSync(file) ? file : null;
}

const calls: Array<{ method: string; url: string }> = [];

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", url: String(url) });
      return new Response(JSON.stringify({ roles: [], role: {}, deleted: "x" }), { status: 200 });
    })
  );
}

afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
});

describe("the admin client's roles calls", () => {
  it("use the store's roles routes, and each one has a handler for its method", async () => {
    stubFetch();
    const accessKeys = {} as Parameters<typeof api.createRole>[1]["accessKeys"];
    await api.listRoles("store_1");
    await api.createRole("store_1", { roleName: "Night clerk", template: "store_clerk" as never, accessKeys });
    await api.saveRole("store_1", "night_clerk", { baseVersion: 1, roleName: "Night clerk", accessKeys });
    await api.deleteRole("store_1", "night_clerk");

    expect(calls).toEqual([
      { method: "GET", url: "/api/v1/admin/stores/store_1/roles" },
      { method: "POST", url: "/api/v1/admin/stores/store_1/roles" },
      { method: "PUT", url: "/api/v1/admin/stores/store_1/roles/night_clerk" },
      { method: "DELETE", url: "/api/v1/admin/stores/store_1/roles/night_clerk" }
    ]);
    for (const call of calls) {
      const file = routeFile(call.url);
      expect(file, call.url).not.toBeNull();
      expect(readFileSync(file!, "utf8"), `${call.method} ${call.url}`).toMatch(
        new RegExp(`export async function ${call.method}\\b`)
      );
    }
  });
});
