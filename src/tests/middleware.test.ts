import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "@/middleware";

/**
 * Admin API calls without a session cookie get the standard error shape;
 * pages redirect to sign-in. Every admin mutation — sign-in included — must
 * come from the admin console (Origin or Sec-Fetch-Site) as JSON, because the
 * store tunnels are the same site as the admin.
 */

afterEach(() => vi.unstubAllEnvs());

const COOKIE = "sd_session=ses_abc.secret";

function mutation(path: string, headers: Record<string, string>, method = "POST") {
  return new NextRequest(`http://localhost${path}`, { method, headers: { cookie: COOKIE, ...headers }, body: "{}" });
}

const passed = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("middleware", () => {
  it("covers staff sign-in as well as the admin API and pages", () => {
    expect(config.matcher).toEqual(expect.arrayContaining(["/api/admin/:path*", "/api/v1/admin/:path*", "/admin/:path*"]));
  });

  it("answers an admin API call without a cookie with 401 UNAUTHORIZED", async () => {
    const res = await middleware(new NextRequest("http://localhost/api/v1/admin/dashboard"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Sign in again." } });
  });

  it("lets a GET with a session-shaped cookie through to the route, which checks it", async () => {
    const res = await middleware(new NextRequest("http://localhost/api/v1/admin/dashboard", { headers: { cookie: COOKIE } }));
    expect(passed(res)).toBe(true);
  });

  it("sends an admin page without a cookie to the sign-in gate", async () => {
    const res = await middleware(new NextRequest("http://localhost/admin/organizations"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/admin-gate?next=%2Fadmin%2Forganizations");
  });

  it.each([
    ["no Origin at all", {}],
    ["a store tunnel's origin (same site, other origin)", { origin: "https://example-retail-store-42.tunnels.storedesk.net" }],
    ["another site", { origin: "https://evil.example" }],
    ["Sec-Fetch-Site: same-site", { "sec-fetch-site": "same-site" }]
  ])("refuses an admin mutation from %s with 403", async (_label, headers) => {
    const res = await middleware(mutation("/api/v1/admin/organizations", { "content-type": "application/json", ...headers }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("CSRF_REJECTED");
  });

  it("lets the admin console's own mutations through, by Origin or Sec-Fetch-Site", async () => {
    expect(passed(await middleware(mutation("/api/v1/admin/organizations", { origin: "http://localhost", "content-type": "application/json" })))).toBe(true);
    expect(passed(await middleware(mutation("/api/v1/admin/organizations/org_1", { "sec-fetch-site": "same-origin", "content-type": "application/json; charset=utf-8" }, "DELETE")))).toBe(true);
  });

  it("refuses an admin mutation that is not JSON with 415", async () => {
    const res = await middleware(mutation("/api/v1/admin/organizations", { origin: "http://localhost", "content-type": "text/plain" }));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("guards staff sign-in and sign-out the same way", async () => {
    const crossSite = new NextRequest("http://localhost/api/admin/login", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
    expect((await middleware(crossSite)).status).toBe(403);
    const own = new NextRequest("http://localhost/api/admin/login", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: "{}" });
    expect(passed(await middleware(own))).toBe(true);
    const formPost = new NextRequest("http://localhost/api/admin/login", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" }, body: "a=b" });
    expect((await middleware(formPost)).status).toBe(415);
  });

  it("uses ADMIN_ORIGIN when it is set", async () => {
    vi.stubEnv("ADMIN_ORIGIN", "https://storedesk.net/");
    expect(passed(await middleware(mutation("/api/v1/admin/organizations", { origin: "https://storedesk.net", "content-type": "application/json" })))).toBe(true);
    expect((await middleware(mutation("/api/v1/admin/organizations", { origin: "http://localhost", "content-type": "application/json" }))).status).toBe(403);
  });

  it("reads the __Host- cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const plain = await middleware(new NextRequest("http://localhost/api/v1/admin/dashboard", { headers: { cookie: COOKIE } }));
    expect(plain.status).toBe(401);
    const host = await middleware(new NextRequest("http://localhost/api/v1/admin/dashboard", { headers: { cookie: "__Host-sd_session=ses_abc.secret" } }));
    expect(passed(host)).toBe(true);
  });
});
