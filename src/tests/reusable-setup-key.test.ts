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
import { GET as getSetup } from "@/app/api/v1/admin/stores/[storeId]/setup/route";
import { POST as issueKey } from "@/app/api/v1/admin/stores/[storeId]/setup-keys/route";
import { GET as revealKey } from "@/app/api/v1/admin/stores/[storeId]/setup-keys/current/route";
import { POST as rotateKey } from "@/app/api/v1/admin/stores/[storeId]/setup-keys/rotate/route";
import { POST as replacePc } from "@/app/api/v1/admin/stores/[storeId]/replace-pc/route";
import { POST as allowReplacement } from "@/app/api/v1/admin/stores/[storeId]/replacement-approval/route";
import { POST as redeem } from "@/app/api/v1/setup-keys/redeem/route";
import { GET as edgeSetupKey } from "@/app/api/v1/edge/setup-key/route";
import { POST as edgeRelease } from "@/app/api/v1/edge/installation/release/route";
import { rotateCloudflareTunnel } from "@/lib/cloudflare";
import { notifyInstallations } from "@/lib/store-notify";
import { resetRateLimitsForTests, publicId } from "@/lib/control-plane-security";
import { APP_USER_HEADER, REPLACEMENT_APPROVAL_MS } from "@/lib/store-setup-key";
import { getEmailProvider, isEmailConfigured } from "@/lib/email-provider";
import {
  AppUserModel,
  AuditEventModel,
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-notify")>();
  return {
    ...actual,
    scheduleNotify: vi.fn(),
    scheduleAppUserNotify: vi.fn(),
    // Records the old PC's notify instead of calling a store.
    notifyInstallations: vi.fn(async () => []),
    runAfterResponse: vi.fn((task: () => Promise<unknown>) => void task()),
    revokeInstallationsAndNotify: vi.fn(actual.revokeInstallationsAndNotify)
  };
});
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn(async () => ({ cloudflareToken: "CF_TOKEN_NEW" }))
}));
vi.mock("@/lib/email-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email-provider")>();
  return {
    ...actual,
    isEmailConfigured: vi.fn(() => true),
    getEmailProvider: vi.fn(() => ({
      sendSetupKey: vi.fn(async () => ({ provider: "test", messageId: "m1" })),
      sendInvitation: vi.fn(async () => ({ provider: "test", messageId: "m2" })),
      sendInstallationReplaced: vi.fn(async () => ({ provider: "test", messageId: "m3" }))
    }))
  };
});

/**
 * The reusable setup key and Replace PC (owner decision 2026-09-17), with the
 * 0.0.9 hardening:
 *
 * - the key can be read at any time and used on the same or another PC, but
 *   **every successful redeem rotates it**, so a key somebody saw once stops
 *   working the moment it is used;
 * - a redeem replaces a live PC only when that PC released itself, or an
 *   admin allowed the replacement (24 h, audited);
 * - reading the key on the store PC needs an organization admin, and the
 *   person is recorded as `metadata.appUserId`;
 * - the organization owner is e-mailed on every replacement.
 */

setupMemoryMongo();

const STORE_SECRET = "store-secret-key-for-tests-0123456789abcdef";

let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let params: { organizationId: string; storeId: string };
/** An app user who is an Organization Admin of the seeded organization. */
let owner: string;

beforeEach(async () => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  process.env.STORE_SECRET_KEY = STORE_SECRET;
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
  await OrganizationModel.updateOne({ organizationId: params.organizationId }, { $set: { billingEmail: "owner@example.invalid" } });
  owner = await makeUser("org_admin");
});
afterEach(() => {
  for (const key of ["STORE_SECRET_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) delete process.env[key];
});

/** An app user with `role` at a store — the only scope an assignment has (D-22). */
async function makeUser(role: string, storeId: string = params.storeId): Promise<string> {
  const appUserId = publicId("appu");
  await AppUserModel.create({ appUserId, email: `${appUserId}@example.invalid`, name: "Test", status: "active", createdByAdminId: admin.adminId });
  await UserAssignmentModel.create({
    assignmentId: publicId("asg"),
    appUserId,
    organizationId: params.organizationId,
    storeId,
    role,
    status: "active",
    createdByAdminId: admin.adminId
  });
  return appUserId;
}

const issue = () => call(issueKey, request("POST", "/", { token: admin.token, body: { deliver: "show" } }), params);
const reveal = (token = admin.token, where = params) => call(revealKey, request("GET", "/", { token }), where);
const rotate = () => call(rotateKey, request("POST", "/", { token: admin.token, body: {} }), params);
const setupView = () => call(getSetup, request("GET", "/", { token: admin.token }), params);
const allow = (where = params) => call(allowReplacement, request("POST", "/", { token: admin.token }), where);

let ipCounter = 0;
function redeemKey(setupKey: string) {
  ipCounter += 1;
  return call(
    redeem,
    request("POST", "/api/v1/setup-keys/redeem", {
      body: { setupKey, acknowledgements: VALID_ACKS, installation: VALID_INSTALLATION },
      headers: { "x-forwarded-for": `198.51.100.${ipCounter % 250}` }
    })
  );
}

const edgeKey = (credential: string, appUserId: string | null = owner) =>
  call(
    edgeSetupKey,
    request("GET", "/api/v1/edge/setup-key", {
      token: credential,
      headers: appUserId ? { [APP_USER_HEADER]: appUserId } : {}
    })
  );
const release = (credential: string, body: unknown = { confirm: "REPLACE_PC", appUserId: owner }) =>
  call(edgeRelease, request("POST", "/api/v1/edge/installation/release", { token: credential, body }));

/** The store's current key, as the store PC would read it. */
const currentKey = async (credential: string) => (await edgeKey(credential)).body.setupKey as string;

async function giveStoreTunnel() {
  process.env.CLOUDFLARE_API_TOKEN = "cf";
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
  await TenantStoreModel.updateOne(
    { storeId: params.storeId },
    {
      $set: {
        tunnelUrl: "https://example-retail-store-42.tunnels.example",
        tunnelLabel: "example-retail-store-42",
        tunnelStatus: "provisioned",
        tunnelId: "cf-tunnel-1",
        cloudflareToken: "CF_TOKEN_OLD"
      }
    }
  );
}

describe("issuing: a reusable key", () => {
  it("never expires, is readable with STORE_SECRET_KEY, and the setup view says so without the key", async () => {
    const issued = await issue();
    expect(issued.status).toBe(201);
    expect(issued.body).toMatchObject({ status: "shown", expiresAt: null, reusable: true, readable: true });

    const record = await SetupKeyModel.findOne({ keyId: issued.body.keyId }).select("+sealedSecret").lean();
    expect(record).toMatchObject({ reusable: true });
    expect(record?.expiresAt).toBeUndefined();
    expect(String(record?.sealedSecret)).toMatch(/^v1\./);
    expect(String(record?.sealedSecret)).not.toContain(issued.body.setupKey.split(".")[1]);

    const view = await setupView();
    expect(view.body.setupKey).toMatchObject({ keyId: issued.body.keyId, reusable: true, readable: true, expiresAt: null, redeemCount: 0 });
    const text = JSON.stringify(view.body);
    expect(text).not.toContain(issued.body.setupKey);
    expect(text).not.toContain("sealedSecret");
    expect(text).not.toContain(String(record?.sealedSecret));
  });

  it("works but can't be shown again when STORE_SECRET_KEY is not set", async () => {
    delete process.env.STORE_SECRET_KEY;
    const issued = await issue();
    expect(issued.body).toMatchObject({ reusable: true, readable: false });
    expect((await redeemKey(issued.body.setupKey)).status).toBe(201);
    const shown = await reveal();
    expect(shown.status).toBe(409);
    expect(shown.body.error.code).toBe("SETUP_KEY_NOT_READABLE");
  });
});

/**
 * HIGH: the key used to be a permanent takeover key — anyone who ever saw it
 * could use it later, on any PC, and the running PC lost the store silently.
 */
describe("a redeem rotates the key", () => {
  it("consumes the key it spent and mints the next one, which the new PC and an admin can read", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    expect(first.status).toBe(201);

    // The key that was shown is spent.
    expect(await SetupKeyModel.findOne({ keyId: body.keyId }).lean()).toMatchObject({ status: "consumed", redeemCount: 1 });

    // A successor exists for the same installation, and is the one both sides read.
    const next = await reveal();
    expect(next.status).toBe(200);
    expect(next.body.keyId).not.toBe(body.keyId);
    expect(next.body.setupKey).not.toBe(body.setupKey);
    expect(next.body.workerInstallationId).toBe(first.body.workerInstallationId);
    expect(await currentKey(first.body.workerCredential)).toBe(next.body.setupKey);

    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ rotatedToKeyId: next.body.keyId, nextKeyReadable: true });
    expect(JSON.stringify(await AuditEventModel.find({}).lean())).not.toContain(next.body.setupKey);
  });

  it("refuses the key that was already spent, and names the current one in the message", async () => {
    const { body } = await issue();
    expect((await redeemKey(body.setupKey)).status).toBe(201);

    const again = await redeemKey(body.setupKey);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("SETUP_KEY_ROTATED");
    expect(again.body.error.message).toContain("current setup key");
  });

  it("leaves the store with exactly one open key after each activation", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);
    await release(pc.body.workerCredential);
    const second = await redeemKey((await reveal()).body.setupKey);
    expect(second.status).toBe(201);

    const open = await SetupKeyModel.countDocuments({
      storeId: params.storeId,
      reusable: true,
      status: { $in: ["queued", "shown", "sent", "delivery_failed"] }
    });
    expect(open).toBe(1);
  });
});

/**
 * HIGH: a live PC is no longer replaced just because somebody holds a key.
 */
describe("replacing a PC that is still running", () => {
  it("is refused with a message the wizard can show", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    expect(first.status).toBe(201);

    const refused = await redeemKey(await currentKey(first.body.workerCredential));
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("PC_ALREADY_ACTIVE");
    expect(refused.body.error.message).toBe(
      "This store already has an active PC. Use Replace PC on it, or ask an admin to allow a replacement."
    );

    // Nothing moved: the running PC keeps its credential and the key was not spent.
    expect(await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean()).toMatchObject({ status: "active" });
    expect(await WorkerCredentialModel.countDocuments({ workerInstallationId: first.body.workerInstallationId, status: "active" })).toBe(1);
  });

  it("is allowed when that PC released itself (Replace PC ran on it)", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    expect((await release(first.body.workerCredential)).status).toBe(200);
    expect(await WorkerInstallationModel.findOne({ workerInstallationId: first.body.workerInstallationId }).lean()).toMatchObject({
      status: "awaiting_activation"
    });

    const second = await redeemKey(key);
    expect(second.status).toBe(201);
    expect(second.body.workerInstallationId).toBe(first.body.workerInstallationId);
    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ replacedPc: false });
  });

  it("is allowed once by an admin's approval, which expires in 24 h and is used up", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);

    const approved = await allow();
    expect(approved.status).toBe(201);
    const until = new Date(approved.body.allowedUntil).getTime();
    expect(until).toBeGreaterThan(Date.now() + REPLACEMENT_APPROVAL_MS - 60_000);
    expect(until).toBeLessThanOrEqual(Date.now() + REPLACEMENT_APPROVAL_MS);
    expect(await lastAudit("installation.replacement_allowed")).toMatchObject({
      actorType: "internal_admin",
      actorId: admin.adminId,
      storeId: params.storeId
    });

    const second = await redeemKey(key);
    expect(second.status).toBe(201);
    expect(second.body.workerCredentialId).not.toBe(first.body.workerCredentialId);
    expect(await WorkerCredentialModel.findOne({ credentialId: first.body.workerCredentialId }).lean()).toMatchObject({ status: "revoked" });
    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ replacedPc: true, approvedByAdminId: admin.adminId });

    // Used up: the next attempt is refused again.
    expect((await TenantStoreModel.findOne({ storeId: params.storeId }).lean())?.replacementAllowedUntil).toBeUndefined();
    const third = await redeemKey(await currentKey(second.body.workerCredential));
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("PC_ALREADY_ACTIVE");
  });

  it("ignores an approval that has expired", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    await allow();
    await TenantStoreModel.updateOne(
      { storeId: params.storeId },
      { $set: { replacementAllowedUntil: new Date(Date.now() - 1000) } }
    );
    expect((await redeemKey(key)).body.error.code).toBe("PC_ALREADY_ACTIVE");
  });

  it("does not let another store's approval count", async () => {
    const other = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail", storeName: "Store 7" });
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    await allow({ organizationId: other.organization.organizationId, storeId: other.store.storeId });
    expect((await redeemKey(key)).body.error.code).toBe("PC_ALREADY_ACTIVE");
  });

  it("still tells the replaced PC and rotates the tunnel when the replacement is allowed", async () => {
    await giveStoreTunnel();
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    expect(first.body.cloudflareToken).toBe("CF_TOKEN_OLD");
    expect(rotateCloudflareTunnel).not.toHaveBeenCalled();
    const key = await currentKey(first.body.workerCredential);
    await allow();

    const second = await redeemKey(key);
    expect(second.status).toBe(201);
    expect(rotateCloudflareTunnel).toHaveBeenCalledWith("cf-tunnel-1");
    expect(second.body.cloudflareToken).toBe("CF_TOKEN_NEW");

    expect(notifyInstallations).toHaveBeenCalledTimes(1);
    const [input, deps] = vi.mocked(notifyInstallations).mock.calls[0]!;
    expect(input).toMatchObject({ workerInstallationIds: [first.body.workerInstallationId], reason: "installation.revoke" });
    const targets = await deps!.loadTargets!(input);
    expect(targets).toEqual([
      { workerInstallationId: first.body.workerInstallationId, tunnelUrl: "https://example-retail-store-42.tunnels.example", relayKey: first.body.relayKey }
    ]);
  });

  it("marks the tunnel for rotation when Cloudflare refuses, and still activates the new PC", async () => {
    await giveStoreTunnel();
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    await allow();
    vi.mocked(rotateCloudflareTunnel).mockRejectedValueOnce(new Error("Cloudflare is down"));
    const second = await redeemKey(key);
    expect(second.status).toBe(201);
    expect((await TenantStoreModel.findOne({ storeId: params.storeId }).lean())?.tunnelRotationRequired).toBe(true);
    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ tunnelRotated: false, tunnelRotationRequired: true });
  });

  it("works after the admin's Replace PC, which needs no approval (the installation is free)", async () => {
    const { body } = await issue();
    expect((await redeemKey(body.setupKey)).status).toBe(201);
    const key = (await reveal()).body.setupKey;
    expect((await call(replacePc, request("POST", "/", { token: admin.token }), params)).status).toBe(200);
    const again = await redeemKey(key);
    expect(again.status).toBe(201);
    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ replacedPc: false });
  });

  it("refuses a suspended store and a missing license like any key", async () => {
    const { body } = await issue();
    await TenantStoreModel.updateOne({ storeId: params.storeId }, { $set: { status: "suspended" } });
    const res = await redeemKey(body.setupKey);
    expect(res.status).toBe(423);
    expect(await WorkerCredentialModel.countDocuments({})).toBe(0);
  });
});

/** HIGH: the organization owner must hear about a replacement, not discover it. */
describe("the organization owner is told", () => {
  it("is e-mailed when an activation replaces the running PC, and the notice is audited", async () => {
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    await allow();
    expect((await redeemKey(key)).status).toBe(201);

    const provider = vi.mocked(getEmailProvider).mock.results.at(-1)!.value as { sendInstallationReplaced: ReturnType<typeof vi.fn> };
    expect(provider.sendInstallationReplaced).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.invalid", by: "activation", storeName: "Store 42" })
    );
    const notice = await lastAudit("installation.replaced_notice");
    expect(notice).toMatchObject({ metadata: expect.objectContaining({ by: "activation", notifiedOwner: true, sentTo: "owner@example.invalid" }) });
  });

  it("is e-mailed when StoreDesk replaces the PC from the console", async () => {
    const { body } = await issue();
    await redeemKey(body.setupKey);
    expect((await call(replacePc, request("POST", "/", { token: admin.token }), params)).status).toBe(200);
    expect(await lastAudit("installation.replaced_notice")).toMatchObject({
      actorType: "internal_admin",
      metadata: expect.objectContaining({ by: "admin", notifiedOwner: true })
    });
  });

  it("records the notice even where e-mail is not configured, and never blocks the replacement", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    const { body } = await issue();
    const first = await redeemKey(body.setupKey);
    const key = await currentKey(first.body.workerCredential);
    await allow();
    expect((await redeemKey(key)).status).toBe(201);
    expect((await lastAudit("installation.replaced_notice"))?.metadata).toMatchObject({
      notifiedOwner: false,
      deliveryError: "e-mail is not configured on this deployment"
    });
    vi.mocked(isEmailConfigured).mockReturnValue(true);
  });
});

describe("the admin reads and rotates the key", () => {
  it("reveals the key any time, audited, never cached, admins only, this organization's store only", async () => {
    const { body } = await issue();

    const shown = await reveal();
    expect(shown.status).toBe(200);
    expect(shown.body).toEqual({ keyId: body.keyId, setupKey: body.setupKey, workerInstallationId: body.workerInstallationId });
    expect(shown.headers.get("Cache-Control")).toContain("no-store");
    const audit = await lastAudit("setup_key.reveal");
    expect(audit).toMatchObject({ actorType: "internal_admin", actorId: admin.adminId, targetId: body.keyId });
    expect(JSON.stringify(audit)).not.toContain(body.setupKey);

    expect((await call(revealKey, request("GET", "/"), params)).status).toBe(401);

    const other = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
    // Staff reach every store, and the path no longer carries an organization to be scoped by
    // (D-22): what refuses a stranger is the session, which the 401 above pins down.
    const cross = await reveal(admin.token, { organizationId: other.organization.organizationId, storeId: params.storeId });
    expect(cross.status).toBe(200);
    expect((await reveal(admin.token, { organizationId: params.organizationId, storeId: "store_nope" })).status).toBe(404);
  });

  it("answers 404 SETUP_KEY_NOT_FOUND before a key exists, and limits reveals to 10 a minute", async () => {
    const none = await reveal();
    expect(none.status).toBe(404);
    expect(none.body.error.code).toBe("SETUP_KEY_NOT_FOUND");
    await issue();
    for (let i = 0; i < 9; i++) expect((await reveal()).status).toBe(200);
    expect((await reveal()).status).toBe(429);
  });

  it("rotating stops the old key, keeps the running PC, and the new key is the one revealed", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);

    const rotated = await rotate();
    expect(rotated.status).toBe(201);
    expect(rotated.body).toMatchObject({ readable: true, workerInstallationId: body.workerInstallationId });
    expect(rotated.body.setupKey).not.toBe(body.setupKey);
    expect(await lastAudit("setup_key.rotate")).toMatchObject({ metadata: expect.objectContaining({ readable: true }) });

    // The running PC still works.
    expect(await WorkerCredentialModel.findOne({ credentialId: pc.body.workerCredentialId }).lean()).toMatchObject({ status: "active" });
    expect((await reveal()).body.setupKey).toBe(rotated.body.setupKey);

    const old = await redeemKey(body.setupKey);
    expect(old.status).toBe(409);
    expect(old.body.error.code).toBe("SETUP_KEY_ROTATED");
    expect((await release(pc.body.workerCredential)).status).toBe(200);
    expect((await redeemKey(rotated.body.setupKey)).status).toBe(201);
  });

  it("gives a store activated with an older single-use key a reusable key", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    expect((await reveal()).status).toBe(404);
    const rotated = await rotate();
    expect(rotated.status).toBe(201);
    expect(rotated.body.workerInstallationId).toBe(pc.workerInstallationId);
    expect((await edgeKey(pc.token)).body.setupKey).toBe(rotated.body.setupKey);
  });
});

/**
 * HIGH: reading the key is an owner-level act. `manageWorker` is a page a
 * store manager can have; the key lets its holder take the store over.
 */
describe("the store PC reads its key", () => {
  it("needs an organization admin, and records who asked", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);
    const current = (await reveal()).body.setupKey;

    const own = await edgeKey(pc.body.workerCredential);
    expect(own.status).toBe(200);
    expect(own.body.setupKey).toBe(current);
    expect(own.headers.get("Cache-Control")).toContain("no-store");
    const audit = await lastAudit("setup_key.reveal");
    expect(audit).toMatchObject({ actorType: "worker", actorId: pc.body.workerCredentialId, metadata: expect.objectContaining({ appUserId: owner }) });
    expect(JSON.stringify(audit)).not.toContain(current);
  });

  it("refuses the worker credential alone, an unknown user, and a user who is not an organization admin", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);

    for (const who of [null, publicId("appu"), await makeUser("store_manager"), await makeUser("viewer")]) {
      const res = await edgeKey(pc.body.workerCredential, who);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_ORG_ADMIN");
    }
    expect(await AuditEventModel.countDocuments({ action: "setup_key.reveal", actorType: "worker" })).toBe(0);
  });

  it("refuses a row with no store, which used to mean every store of the organization", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);

    // The shape D-22 abolished, written straight past the model the way an older release would
    // have. The key lets its holder take the store over, so this must not be a way in.
    const appUserId = publicId("appu");
    await AppUserModel.create({
      appUserId,
      email: `${appUserId}@example.invalid`,
      name: "Owner of everything",
      status: "active",
      createdByAdminId: admin.adminId
    });
    await UserAssignmentModel.collection.insertOne({
      assignmentId: publicId("asg"),
      appUserId,
      organizationId: params.organizationId,
      role: "org_admin",
      scopes: ["relay:request"],
      status: "active",
      createdByAdminId: admin.adminId
    });

    const res = await edgeKey(pc.body.workerCredential, appUserId);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("NOT_ORG_ADMIN");
  });

  it("refuses an organization admin of another organization, and one scoped to another store", async () => {
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);
    const otherStore = await makeUser("org_admin", "store_other");
    expect((await edgeKey(pc.body.workerCredential, otherStore)).status).toBe(403);

    const otherAdmin = await createAdmin("other@example.invalid");
    const other = await seedOrganization(otherAdmin, { slug: "other-retail", name: "Other Retail", storeName: "Store 7" });
    const otherIssued = await call(
      issueKey,
      request("POST", "/", { token: otherAdmin.token, body: { deliver: "show" } }),
      { organizationId: other.organization.organizationId, storeId: other.store.storeId }
    );
    const otherPc = await redeemKey(otherIssued.body.setupKey);
    // This organization's admin is nobody at that store.
    expect((await edgeKey(otherPc.body.workerCredential, owner)).status).toBe(403);
  });

  it("refuses an unknown worker credential and no credential at all", async () => {
    expect((await edgeKey("wcred_nope.secret")).status).toBe(401);
    expect((await call(edgeSetupKey, request("GET", "/api/v1/edge/setup-key"))).status).toBe(401);
  });
});

describe("the store PC gives its installation up", () => {
  it("releases: credential revoked, tunnel rotated, installation awaiting activation; the current key activates again", async () => {
    await giveStoreTunnel();
    const { body } = await issue();
    const pc = await redeemKey(body.setupKey);
    const key = await currentKey(pc.body.workerCredential);

    const refused = await release(pc.body.workerCredential, {});
    expect(refused.status).toBe(400);
    expect(await WorkerCredentialModel.findOne({ credentialId: pc.body.workerCredentialId }).lean()).toMatchObject({ status: "active" });

    const released = await release(pc.body.workerCredential);
    expect(released.status).toBe(200);
    expect(released.body).toEqual({ released: true, tunnelRotated: true, reusableKey: true });
    expect(await WorkerCredentialModel.findOne({ credentialId: pc.body.workerCredentialId }).lean()).toMatchObject({ status: "revoked" });
    const installation = await WorkerInstallationModel.findOne({ workerInstallationId: pc.body.workerInstallationId }).lean();
    expect(installation).toMatchObject({ status: "awaiting_activation" });
    expect(installation?.workerCredentialId).toBeUndefined();

    // MEDIUM: the audit names the person, not only the PC.
    expect(await lastAudit("installation.release")).toMatchObject({
      actorType: "worker",
      metadata: expect.objectContaining({ tunnelRotated: true, appUserId: owner })
    });

    // Works once: the credential is gone.
    expect((await release(pc.body.workerCredential)).status).toBe(401);

    // Same key, "reinstalled" on this PC or another: a fresh credential and the rotated token.
    const again = await redeemKey(key);
    expect(again.status).toBe(201);
    expect(again.body.workerInstallationId).toBe(pc.body.workerInstallationId);
    expect(again.body.cloudflareToken).toBe("CF_TOKEN_NEW");
    // Nothing was live to replace, so no second rotation.
    expect(rotateCloudflareTunnel).toHaveBeenCalledTimes(1);
    expect((await lastAudit("setup_key.redeem"))?.metadata).toMatchObject({ replacedPc: false });
  });

  it("a release that lands after another PC took the installation leaves that PC, its credential and its tunnel alone", async () => {
    await giveStoreTunnel();
    const { body } = await issue();
    const oldPc = await redeemKey(body.setupKey);
    const key = await currentKey(oldPc.body.workerCredential);
    // The old PC authenticated for its release; before the release runs, the new PC redeems the key.
    const oldWorker = {
      organizationId: params.organizationId,
      storeId: params.storeId,
      workerInstallationId: oldPc.body.workerInstallationId,
      credentialId: oldPc.body.workerCredentialId
    };
    await allow();
    const newPc = await redeemKey(key);
    expect(newPc.status).toBe(201);
    vi.mocked(rotateCloudflareTunnel).mockClear();

    const { releaseInstallation } = await import("@/lib/store-setup-key");
    expect(await releaseInstallation(oldWorker, owner)).toMatchObject({ released: true, tunnelRotated: false });

    expect(await WorkerCredentialModel.findOne({ credentialId: newPc.body.workerCredentialId }).lean()).toMatchObject({ status: "active" });
    expect(await WorkerInstallationModel.findOne({ workerInstallationId: newPc.body.workerInstallationId }).lean()).toMatchObject({
      status: "active",
      workerCredentialId: newPc.body.workerCredentialId
    });
    expect(rotateCloudflareTunnel).not.toHaveBeenCalled();
    expect((await lastAudit("installation.release"))?.metadata).toMatchObject({ credentialsRevoked: 0, replacedMeanwhile: true });
  });
});
