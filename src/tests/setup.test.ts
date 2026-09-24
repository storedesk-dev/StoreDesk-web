import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  VALID_ACKS,
  VALID_INSTALLATION,
  call,
  createAdmin,
  lastAudit,
  request,
  seedOrganization,
  type TestAdmin
} from "./helpers/api";
import { GET as getSetup } from "@/app/api/v1/admin/stores/[storeId]/setup/route";
import { POST as issueKey } from "@/app/api/v1/admin/stores/[storeId]/setup-keys/route";
import { POST as replacePc } from "@/app/api/v1/admin/stores/[storeId]/replace-pc/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { updateOrganization } from "@/lib/organizations";
import { updateStore } from "@/lib/tenant-stores";
import { revokeInstallationsAndNotify } from "@/lib/store-notify";
import { AuditEventModel, LicenseModel, SetupKeyModel, WorkerCredentialModel, WorkerInstallationModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-notify")>();
  return {
    ...actual,
    scheduleNotify: vi.fn(),
    scheduleAppUserNotify: vi.fn(),
    revokeInstallationsAndNotify: vi.fn(actual.revokeInstallationsAndNotify)
  };
});
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/**
 * PC & phones: the setup view, the one setup-key path with its entitlement
 * checks (P8), Replace PC (P4), and redeem's validation and per-caller limit (P13).
 */

setupMemoryMongo();

let admin: TestAdmin;
let params: { organizationId: string; storeId: string };
let seeded: Awaited<ReturnType<typeof seedOrganization>>;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ["RESEND_API_KEY", "SETUP_EMAIL_FROM", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) delete process.env[key];
});

function issue(body: unknown = { deliver: "show" }) {
  return call(issueKey, request("POST", "/", { token: admin.token, body }), params);
}

function redeemKey(setupKey: string, ip = "198.51.100.1", overrides: Record<string, unknown> = {}) {
  return call(
    redeem,
    request("POST", "/api/v1/setup-keys/redeem", {
      body: { setupKey, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION, ...overrides },
      headers: { "x-forwarded-for": ip }
    })
  );
}

/** Turn an issued key into the single-use, 24-hour key older builds issued. */
async function singleUse(keyId: string) {
  await SetupKeyModel.updateOne(
    { keyId },
    { $set: { reusable: false, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) }, $unset: { sealedSecret: 1 } }
  );
}

function useEmail(ok = true) {
  process.env.RESEND_API_KEY = "re_test";
  process.env.SETUP_EMAIL_FROM = "StoreDesk <setup@example.invalid>";
  const sent: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return ok
        ? new Response(JSON.stringify({ id: "msg_1" }), { status: 200 })
        : new Response(JSON.stringify({ message: "domain not verified" }), { status: 422 });
    })
  );
  return sent;
}

describe("GET …/setup", () => {
  it("shows the org tag, no PC yet, and why phones can't reach the store", async () => {
    const res = await call(getSetup, request("GET", "/", { token: admin.token }), params);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      organizationSlug: "example-retail",
      installation: null,
      setupKey: null,
      contactEmail: "store42@example.invalid",
      keyBlockedReason: null,
      emailConfigured: false
    });
    expect(res.body.tunnel.status).toBe("not_configured");
    expect(res.body.warnings).toHaveLength(1);
    expect((await call(getSetup, request("GET", "/"), params)).status).toBe(401);
  });

  it("says why a key can't be issued", async () => {
    await LicenseModel.updateOne({ licenseId: seeded.license.licenseId }, { $set: { status: "suspended" } });
    const res = await call(getSetup, request("GET", "/", { token: admin.token }), params);
    expect(res.body.keyBlockedCode).toBe("LICENSE_INACTIVE");
    expect(res.body.license).toMatchObject({ licenseNumber: seeded.license.licenseNumber, status: "suspended" });
    expect(res.body.keyBlockedReason).toContain("suspended");
  });
});

describe("POST …/setup-keys", () => {
  it("shows a key once, creates the PC's installation, audits, and revokes an earlier unused key", async () => {
    const first = await issue();
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: "shown", sentTo: null, installation: { status: "awaiting_activation" } });
    expect(first.body.setupKey).toMatch(/^set_[a-f0-9]{32}\./);
    expect(first.headers.get("Cache-Control")).toContain("no-store");
    expect((await lastAudit("setup_key.issue"))?.metadata).toMatchObject({ deliver: "show", status: "shown" });
    expect(JSON.stringify(await lastAudit("setup_key.issue"))).not.toContain(first.body.setupKey);

    const second = await issue();
    expect(second.body.workerInstallationId).toBe(first.body.workerInstallationId);
    expect((await SetupKeyModel.findOne({ keyId: first.body.keyId }).lean())?.status).toBe("revoked");
    const setup = await call(getSetup, request("GET", "/", { token: admin.token }), params);
    expect(setup.body.setupKey).toMatchObject({ keyId: second.body.keyId, status: "shown" });
    expect(setup.body.installation.status).toBe("awaiting_activation");
    expect(JSON.stringify(setup.body)).not.toContain(second.body.setupKey);
  });

  it("e-mails the key to the store contact, without returning it", async () => {
    const sent = useEmail();
    const res = await issue({ deliver: "email" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "sent", sentTo: "store42@example.invalid" });
    expect(res.body).not.toHaveProperty("setupKey");
    expect(sent[0].to).toEqual(["store42@example.invalid"]);
    expect(String(sent[0].text)).toMatch(/set_[a-f0-9]{32}\./);
  });

  it("answers 502 when the e-mail fails and records delivery_failed", async () => {
    useEmail(false);
    const res = await issue({ deliver: "email" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("SETUP_KEY_DELIVERY_FAILED");
    expect((await SetupKeyModel.findOne({}).sort({ _id: -1 }).lean())?.status).toBe("delivery_failed");
  });

  it("refuses e-mail delivery when e-mail is off or there is no contact", async () => {
    expect((await issue({ deliver: "email" })).body.error.code).toBe("EMAIL_NOT_CONFIGURED");
    useEmail();
    await updateStore(admin, params.storeId, { contactEmail: null });
    const noContact = await issue({ deliver: "email" });
    expect(noContact.status).toBe(400);
    expect(noContact.body.error.code).toBe("CONTACT_EMAIL_REQUIRED");
    expect((await issue({ deliver: "email", contactEmail: "pc@example.invalid" })).body.sentTo).toBe("pc@example.invalid");
  });

  it.each([
    ["an unknown delivery", { deliver: "sms" }],
    ["an unknown field", { deliver: "show", idempotencyKey: "x" }]
  ])("answers 400 for %s", async (_label, body) => {
    expect((await issue(body)).status).toBe(400);
  });

  it("checks the entitlement: the store's license, store and organization status, and the tunnel", async () => {
    await LicenseModel.updateOne({ licenseId: seeded.license.licenseId }, { $set: { entitlementExpiresAt: new Date(Date.now() - 1000) } });
    const lapsed = await issue();
    expect(lapsed.status).toBe(402);
    expect(lapsed.body.error.code).toBe("LICENSE_INACTIVE");
    await LicenseModel.updateOne(
      { licenseId: seeded.license.licenseId },
      { $set: { status: "active", entitlementExpiresAt: new Date(Date.now() + 86_400_000) } }
    );

    await updateStore(admin, params.storeId, { status: "suspended" });
    expect((await issue()).body.error.code).toBe("STORE_SUSPENDED");
    await updateStore(admin, params.storeId, { status: "active" });

    // D-22: a store stands on its own, so its organization's status blocks nothing.
    await updateOrganization(admin, params.organizationId, { status: "suspended" });
    expect((await issue()).status).toBe(201);
    await updateOrganization(admin, params.organizationId, { status: "active" });

    process.env.CLOUDFLARE_API_TOKEN = "cf";
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    const noTunnel = await issue();
    expect(noTunnel.status).toBe(428);
    expect(noTunnel.body.error.code).toBe("TUNNEL_REQUIRED");
  });
});

describe("activation, Replace PC, and the PC limit", () => {
  it("redeems, refuses a second PC at the limit, replaces the PC, and redeems again", async () => {
    const first = await issue();
    const activated = await redeemKey(first.body.setupKey);
    expect(activated.status).toBe(201);
    expect(activated.body.workerCredential).toMatch(/^wcred_/);
    // configJson is the register connection only (P17): no roles, no password.
    expect(Object.keys(JSON.parse(activated.body.configJson)).sort()).toEqual(["posIntegration", "posIpAddress", "posUsername"]);

    const full = await issue();
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("INSTALLATION_LIMIT_REACHED");

    const replaced = await call(replacePc, request("POST", "/", { token: admin.token }), params);
    expect(replaced.status).toBe(200);
    expect(replaced.body.installation).toMatchObject({ status: "awaiting_activation", activatedAt: null });
    expect(revokeInstallationsAndNotify).toHaveBeenCalledWith({
      organizationId: params.organizationId,
      workerInstallationIds: [activated.body.workerInstallationId],
      reason: "installation.revoke"
    });
    expect(await WorkerCredentialModel.countDocuments({ workerInstallationId: activated.body.workerInstallationId, status: "active" })).toBe(0);
    expect(await lastAudit("installation.replace")).toMatchObject({ targetId: activated.body.workerInstallationId });

    const second = await issue();
    expect(second.status).toBe(201);
    expect(second.body.workerInstallationId).toBe(activated.body.workerInstallationId);
    const again = await redeemKey(second.body.setupKey, "198.51.100.2");
    expect(again.status).toBe(201);
    expect(again.body.workerCredentialId).not.toBe(activated.body.workerCredentialId);
    expect(await WorkerInstallationModel.countDocuments({ storeId: params.storeId })).toBe(1);
  });

  it("safe re-redeem (single-use key): the same key for the same installation within 15 minutes gets a fresh credential; the first is revoked", async () => {
    const { body } = await issue();
    await singleUse(body.keyId);
    const first = await redeemKey(body.setupKey);
    expect(first.status).toBe(201);
    const again = await redeemKey(body.setupKey, "198.51.100.11");
    expect(again.status).toBe(201);
    expect(Object.keys(again.body).sort()).toEqual(Object.keys(first.body).sort());
    expect(again.body.workerInstallationId).toBe(first.body.workerInstallationId);
    expect(again.body.workerCredentialId).not.toBe(first.body.workerCredentialId);
    expect(again.body.workerCredential).not.toBe(first.body.workerCredential);
    expect(again.body.relayKey).not.toBe(first.body.relayKey);
    expect(await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean()).toMatchObject({ status: "revoked" });
    expect(await WorkerCredentialModel.countDocuments({ workerInstallationId: first.body.workerInstallationId, status: "active" })).toBe(1);
    expect(await lastAudit("setup_key.re_redeem")).toMatchObject({
      targetId: first.body.workerInstallationId,
      metadata: expect.objectContaining({ previousCredentialId: first.body.workerCredentialId, workerCredentialId: again.body.workerCredentialId })
    });
    // Naming its own installation is fine too.
    const named = await redeemKey(body.setupKey, "198.51.100.12", { workerInstallationId: first.body.workerInstallationId });
    expect(named.status).toBe(201);
  });

  it("re-redeem (single-use key): 409 SETUP_KEY_CONSUMED after 15 minutes or after Replace PC; 409 INSTALLATION_ALREADY_BOUND for another installation", async () => {
    const { body } = await issue();
    await singleUse(body.keyId);
    const first = await redeemKey(body.setupKey);
    const other = await redeemKey(body.setupKey, "198.51.100.13", { workerInstallationId: "winst_someone_else" });
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe("INSTALLATION_ALREADY_BOUND");

    // Bound since by a credential another key issued.
    const original = await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean();
    await WorkerCredentialModel.updateOne({ credentialId: first.body.workerCredentialId }, { $set: { keyId: "set_another" } });
    const rebound = await redeemKey(body.setupKey, "198.51.100.13");
    expect(rebound.status).toBe(409);
    expect(rebound.body.error.code).toBe("INSTALLATION_ALREADY_BOUND");
    await WorkerCredentialModel.updateOne({ credentialId: first.body.workerCredentialId }, { $set: { keyId: original?.keyId } });

    await SetupKeyModel.updateOne({ status: "consumed" }, { $set: { consumedAt: new Date(Date.now() - 16 * 60_000) } });
    const late = await redeemKey(body.setupKey, "198.51.100.14");
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe("SETUP_KEY_CONSUMED");
  });

  it("re-redeem: an old single-use key can't come back after Replace PC", async () => {
    const { body } = await issue();
    await singleUse(body.keyId);
    expect((await redeemKey(body.setupKey)).status).toBe(201);
    expect((await call(replacePc, request("POST", "/", { token: admin.token }), params)).status).toBe(200);
    const res = await redeemKey(body.setupKey, "198.51.100.15");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SETUP_KEY_CONSUMED");
    expect(await WorkerCredentialModel.countDocuments({ status: "active" })).toBe(0);
  });

  it("answers 409 NO_PC_TO_REPLACE when there is no activated PC", async () => {
    const res = await call(replacePc, request("POST", "/", { token: admin.token }), params);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NO_PC_TO_REPLACE");
  });

  it("refuses activation with 423 STORE_SUSPENDED once the store is suspended", async () => {
    const { body } = await issue();
    await updateStore(admin, params.storeId, { status: "suspended" });
    const res = await redeemKey(body.setupKey);
    expect(res.status).toBe(423);
    expect(res.body.error).toMatchObject({ code: "STORE_SUSPENDED", message: "This store is suspended in StoreDesk." });
  });

  it("lets a store activate although its organization is suspended: the cascade is gone (D-22)", async () => {
    const { body } = await issue();
    await updateOrganization(admin, params.organizationId, { status: "suspended" });
    expect((await redeemKey(body.setupKey)).status).toBe(201);
  });

  it("answers an inactive or missing license with store-facing messages (402)", async () => {
    const { body } = await issue();
    await LicenseModel.updateOne({ licenseId: seeded.license.licenseId }, { $set: { status: "suspended" } });
    const inactive = await redeemKey(body.setupKey);
    expect(inactive.status).toBe(402);
    expect(inactive.body.error).toMatchObject({ code: "SUBSCRIPTION_INACTIVE", message: "This store's StoreDesk license isn't active." });
    await LicenseModel.updateOne({ licenseId: seeded.license.licenseId }, { $set: { status: "cancelled" }, $unset: { coverageKey: 1 } });
    const unlicensed = await redeemKey(body.setupKey, "198.51.100.4");
    expect(unlicensed.status).toBe(402);
    expect(unlicensed.body.error).toMatchObject({ code: "STORE_UNLICENSED", message: "This store has no active StoreDesk license." });
  });
});

describe("redeem: setup asks only for the setup key", () => {
  it.each([
    ["no contact e-mail", undefined],
    ["another e-mail than the store contact", "someone@example.invalid"],
    ["a contact e-mail that is not even text", 42]
  ])("redeems with %s, and never refuses over it", async (_label, contactEmail) => {
    const { body } = await issue();
    const res = await redeemKey(body.setupKey, "198.51.100.5", { acknowledgements: { ...VALID_ACKS, contactEmail } });
    expect(res.status).toBe(201);
    expect(await AuditEventModel.countDocuments({ action: "setup_key.redeem_refused" })).toBe(0);
  });

  it("also when the key was issued to an address that overrides the store contact", async () => {
    const { body } = await issue({ deliver: "show", contactEmail: "owner@example.invalid" });
    expect((await redeemKey(body.setupKey, "198.51.100.7")).status).toBe(201);
  });
});

describe("POST /api/v1/setup-keys/redeem validation (P13)", () => {
  it.each([
    ["an unticked acknowledgement", { acknowledgements: { ...VALID_ACKS, privacyAcknowledged: false } }],
    ["a missing acknowledgement", { acknowledgements: { ...VALID_ACKS, osAcknowledged: undefined } }],
    ["a EULA digest that is not SHA-256", { acknowledgements: { ...VALID_ACKS, eulaDocumentSha256: "abc" } }],
    ["an acceptance date that is not one", { acknowledgements: { ...VALID_ACKS, acceptedAt: "yesterday" } }],
    ["an unknown platform", { installation: { ...VALID_INSTALLATION, platform: "amiga" } }]
  ])("answers 400 ACTIVATION_REQUEST_INVALID for %s", async (_label, overrides) => {
    const { body } = await issue();
    const res = await redeemKey(body.setupKey, "198.51.100.3", overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ACTIVATION_REQUEST_INVALID");
  });

  it("limits one caller to 30 attempts in 15 minutes, whatever the key", async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await redeemKey(`set_${i.toString(16).padStart(32, "0")}.${"x".repeat(32)}`, "203.0.113.9")).status).toBe(401);
    }
    const limited = await redeemKey(`set_${"f".repeat(32)}.${"x".repeat(32)}`, "203.0.113.9");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("ACTIVATION_RATE_LIMITED");
    expect((await redeemKey(`set_${"f".repeat(32)}.${"x".repeat(32)}`, "203.0.113.10")).status).toBe(401);
  });
});
