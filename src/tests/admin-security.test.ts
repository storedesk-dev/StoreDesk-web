import { readFileSync } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { ADMIN_PASSWORD, call, createAdmin, request, seedOrganization } from "./helpers/api";
import { GET as whoAmI, POST as login } from "@/app/api/admin/login/route";
import { PUT as putPosCredentials } from "@/app/api/v1/admin/stores/[storeId]/pos-credentials/route";
import { adminCookieName } from "@/lib/admin-auth";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";
import { DEV_LOCAL_BLANKED_ENV } from "@/lib/dev-local-env";
import { LoginThrottleModel } from "@/models/ControlPlane";
import nextConfig from "../../next.config";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(),
  rotateCloudflareTunnel: vi.fn()
}));

/**
 * Staff sign-in lockout held in MongoDB, the __Host- session cookie, JSON-only
 * admin mutations, dev:local's blanked keys, and CORS.
 */

setupMemoryMongo();

const EMAIL = "admin@example.invalid";

beforeEach(async () => {
  await createAdmin(EMAIL);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function attempt(password: string, ip: string) {
  return call(login, request("POST", "/api/admin/login", { body: { email: EMAIL, password }, headers: { "x-forwarded-for": ip } }));
}

describe("sign-in lockout in MongoDB", () => {
  it("counts parallel attempts atomically: only 5 of 10 reach the password check", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => attempt("wrong", `198.51.100.${i}`)));
    const statuses = results.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
  });

  it("holds across server instances: clearing this instance's memory does not unlock", async () => {
    for (let i = 0; i < 5; i += 1) await attempt("wrong", `203.0.113.${i}`);
    resetRateLimitsForTests();
    expect((await attempt(ADMIN_PASSWORD, "203.0.113.99")).status).toBe(429);
  });

  it("stores hashed keys with a TTL index, and a success clears them", async () => {
    await attempt("wrong", "192.0.2.1");
    const rows = await LoginThrottleModel.find({}).lean();
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain(EMAIL);
    expect(JSON.stringify(rows)).not.toContain("192.0.2.1");
    const indexes = await LoginThrottleModel.collection.indexes();
    expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
    expect((await attempt(ADMIN_PASSWORD, "192.0.2.1")).status).toBe(200);
    expect(await LoginThrottleModel.countDocuments()).toBe(0);
  });
});

describe("the session cookie", () => {
  it("is SameSite=Strict, and sd_session outside production (http://localhost)", async () => {
    const res = await attempt(ADMIN_PASSWORD, "192.0.2.5");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^sd_session=ses_/);
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });

  it("is __Host-sd_session in production: Secure, Path=/, no Domain", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(adminCookieName()).toBe("__Host-sd_session");
    const res = await attempt(ADMIN_PASSWORD, "192.0.2.6");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-sd_session=ses_/);
    expect(cookie.toLowerCase()).toContain("secure");
    expect(cookie.toLowerCase()).toContain("path=/");
    expect(cookie.toLowerCase()).not.toContain("domain=");
    const token = cookie.split(";")[0].split("=").slice(1).join("=");
    const me = await call(whoAmI, request("GET", "/", { headers: { cookie: `__Host-sd_session=${token}` } }));
    expect(me.status).toBe(200);
  });
});

describe("JSON-only admin mutations", () => {
  it("refuses a register update sent as a form (415)", async () => {
    const admin = await createAdmin("second@example.invalid");
    const { organization, store } = await seedOrganization(admin);
    const res = await call(
      putPosCredentials,
      new Request("http://localhost/", {
        method: "PUT",
        headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "posIpAddress=10.0.0.1&posUsername=manager"
      }),
      { organizationId: organization.organizationId, storeId: store.storeId }
    );
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
});

describe("dev:local", () => {
  it("blanks the Google service account along with Cloudflare, e-mail and the bootstrap admin", () => {
    expect(DEV_LOCAL_BLANKED_ENV).toContain("GOOGLE_SERVICE_ACCOUNT_JSON");
    expect(DEV_LOCAL_BLANKED_ENV).toEqual(expect.arrayContaining(["CLOUDFLARE_API_TOKEN", "RESEND_API_KEY", "SUPPORT_ADMIN_PASSWORD"]));
    const script = readFileSync(path.resolve(__dirname, "../../scripts/dev-local.ts"), "utf8");
    expect(script).toContain("DEV_LOCAL_BLANKED_ENV");
  });
});

describe("CORS (next.config.ts)", () => {
  it("sends no CORS headers on the admin API or sign-in, never with credentials, and only a GET-only wildcard on the org-tag lookup", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((rule) => rule.source)).toEqual(["/api/v1/app-auth/organizations/:slug"]);
    const headers = rules.flatMap((rule) => rule.headers);
    expect(headers.find((header) => header.key === "Access-Control-Allow-Credentials")).toBeUndefined();
    expect(headers).toContainEqual({ key: "Access-Control-Allow-Methods", value: "GET" });
  });
});
