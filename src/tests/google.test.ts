import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as getSettings } from "@/app/api/v1/admin/stores/[storeId]/settings/route";
import { googleServiceAccountEmail, loadServiceAccount } from "@/lib/google";

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
 * StoreDesk's Google account. The key stays in the control plane; the admin's
 * store settings show only its address, for the owner to share a sheet with.
 */

setupMemoryMongo();

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});
const CLIENT_EMAIL = "sheets@storedesk-test.iam.gserviceaccount.com";
const KEY_FILE = { type: "service_account", client_email: CLIENT_EMAIL, private_key: privateKey, token_uri: "https://oauth2.googleapis.com/token" };

let admin: TestAdmin;
let params: { organizationId: string; storeId: string };

beforeEach(async () => {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(KEY_FILE)).toString("base64");
  admin = await createAdmin();
  const seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});
afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
});

describe("the service account", () => {
  it("reads the key file as base64 or raw JSON, with escaped newlines", () => {
    expect(loadServiceAccount()?.clientEmail).toBe(CLIENT_EMAIL);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...KEY_FILE, private_key: privateKey.replace(/\n/g, "\\n") });
    expect(loadServiceAccount()?.privateKey).toBe(privateKey);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not a key";
    expect(loadServiceAccount()).toBeNull();
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    expect(googleServiceAccountEmail()).toBeNull();
  });
});

describe("the admin settings", () => {
  it("the settings answer carries the service-account address, never the key", async () => {
    const res = await call(getSettings, request("GET", "/", { token: admin.token }), params);
    expect(res.body.googleClientEmail).toBe(CLIENT_EMAIL);
    expect(JSON.stringify(res.body)).not.toContain("PRIVATE KEY");
  });
});
