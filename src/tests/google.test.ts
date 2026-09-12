import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { POST as check } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/google-sheets/check/route";
import { GET as getSettings } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/route";
import { POST as accessToken } from "@/app/api/v1/edge/google/access-token/route";
import {
  GOOGLE_SCOPES,
  loadServiceAccount,
  mintGoogleAccessToken,
  resetGoogleTokenCacheForTests,
  signJwtAssertion
} from "@/lib/google";
import { updateStoreSettings } from "@/lib/tenant-stores";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/**
 * StoreDesk's Google account: the key stays in the control plane; the admin
 * checks a sheet is shared with it, and a store server gets a short-lived token.
 */

setupMemoryMongo();

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
const CLIENT_EMAIL = "sheets@storedesk-test.iam.gserviceaccount.com";
const KEY_FILE = { type: "service_account", client_email: CLIENT_EMAIL, private_key: privateKey, token_uri: "https://oauth2.googleapis.com/token" };
const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
const SHEET = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const TOKEN = "ya29.test-access-token";

let sheetStatus = 200;
let tokenStatus = 200;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  void init;
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return tokenStatus === 200
      ? new Response(JSON.stringify({ access_token: TOKEN, expires_in: 3600, token_type: "Bearer" }), { status: 200 })
      : new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid JWT Signature." }), { status: tokenStatus });
  }
  if (url.startsWith("https://sheets.googleapis.com/")) {
    return sheetStatus === 200
      ? new Response(JSON.stringify({ properties: { title: "Daily Sales Book" }, sheets: [{ properties: { title: "Daily" } }, { properties: { title: "Weekly" } }] }), { status: 200 })
      : new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }), { status: sheetStatus });
  }
  throw new Error(`unexpected fetch ${url}`);
});

let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let params: { organizationId: string; storeId: string };

beforeEach(async () => {
  vi.clearAllMocks();
  sheetStatus = 200;
  tokenStatus = 200;
  resetGoogleTokenCacheForTests();
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(KEY_FILE)).toString("base64");
  vi.stubGlobal("fetch", fetchMock);
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
});

describe("the service account", () => {
  it("reads the key file as base64 or raw JSON, with escaped newlines", () => {
    expect(loadServiceAccount()?.clientEmail).toBe(CLIENT_EMAIL);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...KEY_FILE, private_key: privateKey.replace(/\n/g, "\\n") });
    expect(loadServiceAccount()?.privateKey).toBe(privateKey);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not a key";
    expect(loadServiceAccount()).toBeNull();
  });

  it("signs an RS256 assertion for the sheets and drive.readonly scopes", () => {
    const jwt = signJwtAssertion(loadServiceAccount()!, GOOGLE_SCOPES, 1_900_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_900_000_000,
      exp: 1_900_003_600
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, signature, "base64url")).toBe(true);
  });

  it("exchanges the assertion with the JWT bearer grant and reuses the token", async () => {
    const first = await mintGoogleAccessToken();
    expect(first).toMatchObject({ accessToken: TOKEN, clientEmail: CLIENT_EMAIL });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = new URLSearchParams(String(init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(form.get("assertion")?.split(".")).toHaveLength(3);
    await mintGoogleAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers 502 GOOGLE_UNAVAILABLE when Google refuses the key", async () => {
    tokenStatus = 400;
    await expect(mintGoogleAccessToken()).rejects.toMatchObject({ status: 502, code: "GOOGLE_UNAVAILABLE" });
  });
});

describe("POST …/settings/google-sheets/check", () => {
  function checkSheet(body: unknown) {
    return call(check, request("POST", "/", { token: admin.token, body }), params);
  }

  it("answers the sheet's title and tabs, with the address to share it with", async () => {
    const res = await checkSheet({ spreadsheetUrl: SHEET });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, clientEmail: CLIENT_EMAIL, spreadsheetId: SHEET_ID, title: "Daily Sales Book", sheets: ["Daily", "Weekly"] });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain(`/spreadsheets/${SHEET_ID}?`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("uses the store's saved link when none is sent", async () => {
    await updateStoreSettings(admin, params.organizationId, params.storeId, { integrations: { googleSheets: { enabled: true, spreadsheetUrl: SHEET, sheetName: null, headerRow: 1 } } }, 1);
    expect((await checkSheet({})).body.spreadsheetId).toBe(SHEET_ID);
  });

  it("answers 422 SHEET_NOT_SHARED with the service-account address", async () => {
    sheetStatus = 403;
    const res = await checkSheet({ spreadsheetUrl: SHEET });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: "SHEET_NOT_SHARED" }, clientEmail: CLIENT_EMAIL });
    expect(res.body.error.message).toContain(CLIENT_EMAIL);
  });

  it("answers 400 for a link that is not a sheet, 503 when the account is not configured, 401 without a session", async () => {
    expect((await checkSheet({ spreadsheetUrl: "https://example.com/x" })).status).toBe(400);
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const off = await checkSheet({ spreadsheetUrl: SHEET });
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe("GOOGLE_NOT_CONFIGURED");
    expect((await call(check, request("POST", "/", { body: {} }), params)).status).toBe(401);
  });

  it("the settings answer carries the service-account address", async () => {
    const res = await call(getSettings, request("GET", "/", { token: admin.token }), params);
    expect(res.body.googleClientEmail).toBe(CLIENT_EMAIL);
  });
});

describe("POST /api/v1/edge/google/access-token", () => {
  async function ask(token?: string) {
    return call(accessToken, request("POST", "/", { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
  }

  it("gives a Google Sheets store a short-lived token, audited without it", async () => {
    const pc = await activatePc(params.organizationId, params.storeId, seeded.subscription.subscriptionId);
    await updateStoreSettings(admin, params.organizationId, params.storeId, { integrations: { googleSheets: { enabled: true, spreadsheetUrl: SHEET, sheetName: null, headerRow: 1 } } }, 1);
    const res = await ask(pc.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: TOKEN, clientEmail: CLIENT_EMAIL, scopes: GOOGLE_SCOPES });
    expect(res.body.expiresAt).toMatch(/^\d{4}-/);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const audit = await lastAudit("edge.google_access_token");
    expect(audit).toMatchObject({ actorType: "worker", actorId: pc.workerInstallationId });
    expect(JSON.stringify(audit)).not.toContain(TOKEN);
    expect(JSON.stringify(res.body)).not.toContain("PRIVATE KEY");
  });

  it("refuses a store without Google Sheets, a deployment without the key, and a caller without a credential", async () => {
    const pc = await activatePc(params.organizationId, params.storeId, seeded.subscription.subscriptionId);
    const disabled = await ask(pc.token);
    expect(disabled.status).toBe(409);
    expect(disabled.body.error.code).toBe("GOOGLE_SHEETS_NOT_ENABLED");
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const off = await ask(pc.token);
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe("GOOGLE_NOT_CONFIGURED");
    expect((await ask()).status).toBe(401);
  });

  it("rate-limits one installation to 20 tokens in 10 minutes", async () => {
    const pc = await activatePc(params.organizationId, params.storeId, seeded.subscription.subscriptionId);
    await updateStoreSettings(admin, params.organizationId, params.storeId, { integrations: { googleSheets: { enabled: true, spreadsheetUrl: SHEET, sheetName: null, headerRow: 1 } } }, 1);
    for (let i = 0; i < 20; i += 1) expect((await ask(pc.token)).status).toBe(200);
    expect((await ask(pc.token)).status).toBe(429);
  });
});
