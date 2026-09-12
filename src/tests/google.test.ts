import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { POST as check } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/google-sheets/check/route";
import { GET as getSettings } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/settings/route";
import { GET as sheetMeta } from "@/app/api/v1/edge/google/sheets/meta/route";
import { GET as sheetValues } from "@/app/api/v1/edge/google/sheets/values/route";
import { POST as sheetAppend } from "@/app/api/v1/edge/google/sheets/append/route";
import {
  GOOGLE_SCOPES,
  loadServiceAccount,
  mintGoogleAccessToken,
  parseSheetRange,
  resetGoogleTokenCacheForTests,
  signJwtAssertion
} from "@/lib/google";
import { updateStoreSettings } from "@/lib/tenant-stores";
import { AuditEventModel } from "@/models/ControlPlane";

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
 * StoreDesk's Google account. The key and every access token stay in the
 * control plane; the admin checks a sheet is shared with it, and a store
 * server reaches its own configured sheet — and only that one — through the
 * proxy.
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
const OTHER_ID = "1ZzOtherCustomersSheet000000000000000";
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
    if (sheetStatus !== 200) return new Response(JSON.stringify({ error: { message: "denied" } }), { status: sheetStatus });
    if (url.includes(":append")) {
      return new Response(JSON.stringify({ updates: { updatedRange: "'Daily'!A11:C12", updatedRows: 2 } }), { status: 200 });
    }
    if (url.includes("/values/")) {
      return new Response(JSON.stringify({ range: "'Daily'!A1:D10", majorDimension: "ROWS", values: [["Date", "Sales"], ["2026-09-12", "1234.56"]] }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        properties: { title: "Daily Sales Book" },
        sheets: [
          { properties: { title: "Daily", gridProperties: { rowCount: 1000 } } },
          { properties: { title: "Weekly", gridProperties: { rowCount: 52 } } }
        ]
      }),
      { status: 200 }
    );
  }
  throw new Error(`unexpected fetch ${url}`);
});

const sheetsCalls = () =>
  fetchMock.mock.calls
    .map(([url, init]) => ({ url: String(url), init: init as RequestInit | undefined }))
    .filter((entry) => entry.url.startsWith("https://sheets.googleapis.com/"));

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

async function enableSheet() {
  await updateStoreSettings(
    admin,
    params.organizationId,
    params.storeId,
    { integrations: { googleSheets: { enabled: true, spreadsheetUrl: SHEET, sheetName: "Daily", headerRow: 1 } } },
    1
  );
}

describe("the service account", () => {
  it("reads the key file as base64 or raw JSON, with escaped newlines", () => {
    expect(loadServiceAccount()?.clientEmail).toBe(CLIENT_EMAIL);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...KEY_FILE, private_key: privateKey.replace(/\n/g, "\\n") });
    expect(loadServiceAccount()?.privateKey).toBe(privateKey);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not a key";
    expect(loadServiceAccount()).toBeNull();
  });

  it("signs an RS256 assertion for the spreadsheets scope only", () => {
    const jwt = signJwtAssertion(loadServiceAccount()!, GOOGLE_SCOPES, 1_900_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_900_000_000,
      exp: 1_900_003_600
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, signature, "base64url")).toBe(true);
  });

  it("exchanges the assertion with the JWT bearer grant and caches the token in memory", async () => {
    expect(await mintGoogleAccessToken()).toMatchObject({ accessToken: TOKEN, clientEmail: CLIENT_EMAIL });
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

describe("parseSheetRange", () => {
  it.each([
    ["Daily!A1:D10", "'Daily'!A1:D10", 10],
    ["'Daily Sales'!a2:c4", "'Daily Sales'!A2:C4", 3],
    ["'Bob''s tab'!B7", "'Bob''s tab'!B7", 1],
    ["Daily!2:40", "'Daily'!2:40", 39],
    ["Daily!A:D", "'Daily'!A1:D5000", null],
    ["Daily!A2:D", "'Daily'!A2:D5001", null],
    ["Daily", "'Daily'!1:5000", null]
  ])("reads %j as %j", (input, a1, rows) => {
    expect(parseSheetRange(input, 5000)).toMatchObject({ a1, rows });
  });

  it.each([
    "A1:D10",
    "Daily!A1:B2:C3",
    "Daily!A1,Weekly!A1",
    `${OTHER_ID}/values/Daily!A1`,
    "../x!A1",
    "Daily Sales!A1",
    "Daily!ZZZZ1",
    "Daily!A10:D1",
    "Daily!A1:4",
    "Daily!A",
    "'unterminated!A1",
    ""
  ])("refuses %j", (input) => {
    expect(parseSheetRange(input, 5000)).toBeNull();
  });
});

describe("POST …/settings/google-sheets/check (admin)", () => {
  function checkSheet(body: unknown) {
    return call(check, request("POST", "/", { token: admin.token, body }), params);
  }

  it("answers the sheet's title and tabs, with the address to share it with", async () => {
    const res = await checkSheet({ spreadsheetUrl: SHEET });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, clientEmail: CLIENT_EMAIL, spreadsheetId: SHEET_ID, title: "Daily Sales Book", sheets: ["Daily", "Weekly"] });
    expect(sheetsCalls()[0].url).toContain(`/spreadsheets/${SHEET_ID}?`);
    expect((sheetsCalls()[0].init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });

  it("uses the store's saved link when none is sent", async () => {
    await enableSheet();
    expect((await checkSheet({})).body.spreadsheetId).toBe(SHEET_ID);
  });

  it("answers 422 SHEET_NOT_SHARED with the service-account address", async () => {
    sheetStatus = 403;
    const res = await checkSheet({ spreadsheetUrl: SHEET });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: { code: "SHEET_NOT_SHARED" }, clientEmail: CLIENT_EMAIL });
  });

  it("answers 400 for a link that is not a sheet, 503 without the account, 401 without a session", async () => {
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

describe("the store server's sheet proxy", () => {
  const edge = (token: string, path: string, body?: unknown) =>
    request(body === undefined ? "GET" : "POST", path, { body, headers: { Authorization: `Bearer ${token}` } });

  it("reads the store's own sheet: meta and values, audited with counts only", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    const meta = await call(sheetMeta, edge(pc.token, "/api/v1/edge/google/sheets/meta"));
    expect(meta.status).toBe(200);
    expect(meta.body).toEqual({
      spreadsheetId: SHEET_ID,
      title: "Daily Sales Book",
      sheets: [{ title: "Daily", rowCount: 1000 }, { title: "Weekly", rowCount: 52 }]
    });
    expect(meta.headers.get("Cache-Control")).toContain("no-store");

    const values = await call(sheetValues, edge(pc.token, `/api/v1/edge/google/sheets/values?range=${encodeURIComponent("Daily!A1:D10")}`));
    expect(values.status).toBe(200);
    expect(values.body).toEqual({ range: "'Daily'!A1:D10", values: [["Date", "Sales"], ["2026-09-12", "1234.56"]], truncated: false });
    expect(sheetsCalls()[1].url).toContain(`/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'Daily'!A1:D10")}?`);

    const audit = await lastAudit("edge.sheets.read");
    expect(audit).toMatchObject({ actorType: "worker", actorId: pc.workerInstallationId, storeId: params.storeId });
    expect(audit?.metadata).toMatchObject({ rows: 2 });
    expect(JSON.stringify(await AuditEventModel.find({}).lean())).not.toContain("1234.56");
    expect(JSON.stringify([meta.body, values.body])).not.toContain(TOKEN);
  });

  it("never reaches another spreadsheet, whatever the request names", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    await call(sheetMeta, edge(pc.token, `/api/v1/edge/google/sheets/meta?spreadsheetId=${OTHER_ID}`));
    await call(sheetValues, edge(pc.token, `/api/v1/edge/google/sheets/values?range=Daily!A1&spreadsheetId=${OTHER_ID}`));
    const smuggled = await call(sheetValues, edge(pc.token, `/api/v1/edge/google/sheets/values?range=${encodeURIComponent(`${OTHER_ID}/values/Daily!A1`)}`));
    expect(smuggled.status).toBe(400);
    const inBody = await call(sheetAppend, edge(pc.token, "/api/v1/edge/google/sheets/append", { spreadsheetId: OTHER_ID, range: "Daily", values: [["x"]] }));
    expect(inBody.status).toBe(400);
    expect(sheetsCalls()).toHaveLength(2);
    for (const { url } of sheetsCalls()) {
      expect(url).toContain(`/spreadsheets/${SHEET_ID}`);
      expect(url).not.toContain(OTHER_ID);
    }
  });

  it("bounds an open range at 5,000 rows and refuses a larger one", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    await call(sheetValues, edge(pc.token, "/api/v1/edge/google/sheets/values?range=Daily!A:D"));
    expect(sheetsCalls()[0].url).toContain(encodeURIComponent("'Daily'!A1:D5000"));
    const big = await call(sheetValues, edge(pc.token, "/api/v1/edge/google/sheets/values?range=Daily!A1:D5001"));
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe("RANGE_TOO_LARGE");
    const none = await call(sheetValues, edge(pc.token, "/api/v1/edge/google/sheets/values"));
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe("RANGE_INVALID");
  });

  it("appends rows as typed text (RAW), audited with counts only", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    const rows = [["2026-09-12", 1234.56, "=HYPERLINK(\"x\")"], ["2026-09-13", 99, null]];
    const res = await call(sheetAppend, edge(pc.token, "/api/v1/edge/google/sheets/append", { range: "Daily!A1", values: rows }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedRange: "'Daily'!A11:C12", updatedRows: 2 });
    const { url, init } = sheetsCalls()[0];
    expect(url).toContain(`/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'Daily'!A1")}:append?`);
    expect(url).toContain("valueInputOption=RAW");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body)).values).toEqual(rows);
    const audit = await lastAudit("edge.sheets.append");
    expect(audit?.metadata).toMatchObject({ rows: 2, columns: 3, updatedRows: 2 });
    expect(JSON.stringify(audit)).not.toContain("1234.56");
    expect(JSON.stringify(audit)).not.toContain("HYPERLINK");
  });

  it.each([
    ["1,001 rows", { range: "Daily", values: Array.from({ length: 1001 }, () => ["x"]) }],
    ["51 columns", { range: "Daily", values: [Array.from({ length: 51 }, () => "x")] }],
    ["no rows", { range: "Daily", values: [] }],
    ["a cell that is an object", { range: "Daily", values: [[{ formula: "=1" }]] }],
    ["a range across tabs", { range: "Daily!A1,Weekly!A1", values: [["x"]] }]
  ])("refuses an append of %s with 400", async (_label, body) => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    const res = await call(sheetAppend, edge(pc.token, "/api/v1/edge/google/sheets/append", body));
    expect(res.status).toBe(400);
    expect(sheetsCalls()).toHaveLength(0);
  });

  it("answers 422 when the sheet is not shared for writing", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    sheetStatus = 403;
    const res = await call(sheetAppend, edge(pc.token, "/api/v1/edge/google/sheets/append", { range: "Daily", values: [["x"]] }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHEET_NOT_SHARED");
    expect(res.body.error.message).toContain("Editor");
  });

  it("refuses a store without Google Sheets (409), a deployment without the key (503) and no credential (401)", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const disabled = await call(sheetMeta, edge(pc.token, "/api/v1/edge/google/sheets/meta"));
    expect(disabled.status).toBe(409);
    expect(disabled.body.error.code).toBe("GOOGLE_SHEETS_NOT_ENABLED");
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const off = await call(sheetValues, edge(pc.token, "/api/v1/edge/google/sheets/values?range=Daily"));
    expect(off.status).toBe(503);
    expect(off.body.error.code).toBe("GOOGLE_NOT_CONFIGURED");
    expect((await call(sheetMeta, request("GET", "/"))).status).toBe(401);
    expect(sheetsCalls()).toHaveLength(0);
  });

  it("rate-limits one installation to 60 calls a minute across the three routes", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    await enableSheet();
    for (let i = 0; i < 60; i += 1) expect((await call(sheetMeta, edge(pc.token, "/api/v1/edge/google/sheets/meta"))).status).toBe(200);
    const limited = await call(sheetValues, edge(pc.token, "/api/v1/edge/google/sheets/values?range=Daily"));
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("GOOGLE_SHEETS_RATE_LIMITED");
  });
});
