/**
 * Setting a StoreDesk Lottery PC up.
 *
 * Deliberately a separate path from StoreDesk's activation, not a branch inside it. A lottery PC is
 * a different product (lib/products.ts): it has no tunnel, no relay key, no register configuration
 * and no place in the store's PC count, so it must never be handed any of them. Keeping the two
 * apart is what stops a lottery PC ever receiving a store's tunnel token by accident.
 *
 * The chain the app walks: the person types the organization tag, the public lookup lists the
 * stores with the reason any of them cannot be picked, and this key is what authorises the claim.
 */

import { connectDb } from "@/lib/db";
import { SetupKeyModel, WorkerCredentialModel, WorkerInstallationModel } from "@/models/ControlPlane";
import {
  ControlPlaneError,
  CONTRACT_VERSION,
  enforceRateLimit,
  hashSecret,
  issueRelayKey,
  issueWorkerCredential,
  parseSetupKey,
  publicId,
  verifySecret
} from "@/lib/control-plane-security";
import { auditAdmin, writeAudit } from "@/lib/audit";
import { coverageFor, expireLapsedLicenses, licenseProblem } from "@/lib/licenses";
import { requireOrganization } from "@/lib/organizations";
import { requireStore } from "@/lib/tenant-stores";
import { normalizeStoreSettings } from "@/lib/store-settings";
import { mintReusableKey } from "@/lib/store-setup-key";
import { LOTTERY, productFilter } from "@/lib/products";
import type { InternalAdminActor } from "@/lib/admin-auth";

type Doc = Record<string, unknown>;

const OPEN_KEY = ["queued", "shown", "sent", "delivery_failed"];
const LIVE = ["active", "degraded", "updating", "rollback"];

/** Why a store cannot run the lottery app. The app shows these words; the picker greys the row. */
function whyBlocked(org: Doc, store: Doc, license: Doc | null, mode: Parameters<typeof licenseProblem>[1]) {
  if (org.status === "suspended") {
    return { status: 409, code: "ORGANIZATION_SUSPENDED", message: "The organization is suspended." };
  }
  if (store.status !== "active") {
    return { status: 409, code: "STORE_SUSPENDED", message: `The store is ${String(store.status)}.` };
  }
  const settings = normalizeStoreSettings(store.settings);
  // One switch, not two. A store that sells lottery tickets runs StoreDesk Lottery — there is no
  // second opt-in, because there is no version of this product where a store sells lottery and we
  // hand them somebody else's rack. "Has lottery" is the whole answer.
  if (settings.capabilities.lottery !== true) {
    return {
      status: 409,
      code: "STORE_NO_LOTTERY",
      message: "This store isn't set up for lottery. Ask your StoreDesk contact to switch it on."
    };
  }
  const problem = licenseProblem(license, mode);
  if (problem) return { status: 402, code: problem.code, message: problem.message };
  return null;
}

async function loadStore(organizationId: string, storeId: string) {
  const org = await requireOrganization(organizationId);
  const store = await requireStore(organizationId, storeId);
  await expireLapsedLicenses({ organizationId });
  const coverage = await coverageFor(store, org);
  const blocked = whyBlocked(org, store, coverage.license, coverage.mode);
  if (blocked) throw new ControlPlaneError(blocked.status, blocked.code, blocked.message);
  return { org, store, coverage };
}

/**
 * The store's lottery installation, created on first ask. One per store: the app's data and its
 * sealed config live on one PC at a time, and claiming on a second PC moves the setup rather than
 * making a second copy.
 */
async function installationFor(organizationId: string, storeId: string, contactEmail: string) {
  const existing = (await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    ...productFilter(LOTTERY)
  }).lean()) as Doc | null;
  if (existing) return String(existing.workerInstallationId);

  const workerInstallationId = publicId("winst");
  await WorkerInstallationModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    product: LOTTERY,
    workerName: "StoreDesk Lottery",
    contactEmail,
    status: "awaiting_activation"
  });
  return workerInstallationId;
}

/** Issue the key that authorises a lottery PC for this store. Admin action, audited. */
export async function issueLotterySetupKey(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  contactEmail?: string
) {
  await connectDb();
  const { store } = await loadStore(organizationId, storeId);
  const email = contactEmail ?? String(store.contactEmail ?? "");
  if (!email) {
    throw new ControlPlaneError(400, "REQUEST_INVALID", "A contact e-mail is needed for the setup key");
  }

  const workerInstallationId = await installationFor(organizationId, storeId, email);
  const minted = await mintReusableKey({
    organizationId,
    storeId,
    workerInstallationId,
    contactEmail: email,
    status: "shown",
    deliveryReason: "lottery_setup",
    adminId: admin.adminId
  });

  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId,
    action: "lottery.setup_key.issue",
    targetType: "worker_installation",
    targetId: workerInstallationId
  });

  return {
    contractVersion: CONTRACT_VERSION,
    workerInstallationId,
    keyId: minted.keyId,
    setupKey: minted.plaintext,
    storeName: String(store.name)
  };
}

export interface LotteryClaim {
  readonly setupKey: string;
  readonly deviceName: string;
  readonly appVersion?: string;
}

/**
 * Give this PC the store's lottery installation: revoke whatever credential the installation had,
 * issue a new one, and name the PC. Shared by the two ways in — a setup key, or the store's own
 * StoreDesk Service vouching for it — because everything after "which store, and may it?" is the same.
 */
async function claimInstallation(input: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  deviceName: string;
  appVersion?: string;
  keyId: string | null;
  via: "setup_key" | "storedesk_service";
  actorId: string;
}) {
  const { organizationId, storeId, workerInstallationId } = input;
  const installation = (await WorkerInstallationModel.findOne({ workerInstallationId }).lean()) as Doc | null;
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found");

  const previous = (await WorkerCredentialModel.findOne({ workerInstallationId, status: "active" }).lean()) as Doc | null;
  const replacedPc = previous !== null && LIVE.includes(String(installation.status));

  const credential = issueWorkerCredential();
  const now = new Date();

  if (previous) {
    await WorkerCredentialModel.updateOne(
      { credentialId: previous.credentialId },
      { $set: { status: "revoked", revokedAt: now } }
    );
  }
  await WorkerCredentialModel.create({
    credentialId: credential.credentialId,
    secretHash: await hashSecret(credential.secret),
    // Stored because every credential has one, and never returned: the lottery app makes its own
    // sessions locally and has no use for it.
    relayKey: issueRelayKey(),
    keyId: input.keyId ?? `vouched_${input.workerInstallationId}`,
    organizationId,
    storeId,
    workerInstallationId,
    status: "active",
    issuedAt: now
  });
  await WorkerInstallationModel.updateOne(
    { workerInstallationId },
    {
      $set: {
        status: "active",
        workerCredentialId: credential.credentialId,
        activatedAt: now,
        workerName: input.deviceName,
        ...(input.appVersion ? { workerVersion: input.appVersion } : {})
      }
    }
  );

  await writeAudit({
    organizationId,
    storeId,
    workerInstallationId,
    actorType: "system",
    actorId: input.actorId,
    action: replacedPc ? "lottery.installation.move" : "lottery.installation.claim",
    targetType: "worker_installation",
    targetId: workerInstallationId,
    metadata: { deviceName: input.deviceName, replacedPc, via: input.via }
  });

  return { credential, replacedPc };
}

/**
 * The store's StoreDesk Service vouches for this PC, so nobody types anything.
 *
 * A store that already runs StoreDesk has proved who it is once: its service holds a worker
 * credential for exactly one store. When the lottery app finds that service and it answers for the
 * same store, a setup key would only be ceremony. The key path stays for a lottery-only store, which
 * has no service to vouch for it.
 *
 * The caller is the service, not the app: the credential never leaves the service's process, and the
 * service's own routes are behind its session gate, so a signed-in person is what starts this.
 */
export async function claimLotteryForWorker(
  worker: { organizationId: string; storeId: string; workerInstallationId: string },
  input: { deviceName: string; appVersion?: string }
) {
  await connectDb();
  const { store, coverage } = await loadStore(worker.organizationId, worker.storeId);
  const workerInstallationId = await installationFor(
    worker.organizationId,
    worker.storeId,
    String(store.contactEmail ?? "lottery@storedesk.invalid")
  );

  const { credential, replacedPc } = await claimInstallation({
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId,
    deviceName: input.deviceName,
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    keyId: null,
    via: "storedesk_service",
    actorId: worker.workerInstallationId
  });

  return {
    contractVersion: CONTRACT_VERSION,
    workerCredential: credential.plaintext,
    workerCredentialId: credential.credentialId,
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId,
    replacedPc,
    store: {
      name: String(store.name),
      storeNumber: store.storeNumber ? String(store.storeNumber) : null,
      timeZone: normalizeStoreSettings(store.settings).timeZone
    },
    licence: {
      number: coverage.license ? String(coverage.license.licenseNumber) : null,
      scope: coverage.license ? String(coverage.license.scope) : null,
      status: coverage.license ? String(coverage.license.status) : null
    }
  };
}

/**
 * Claim this PC for the store the key belongs to.
 *
 * A PC that already holds the store is replaced: the person was shown which PC that is and chose to
 * continue, so the move needs no second approval — but the old credential is revoked here, so the
 * previous PC stops working the moment this one starts, and both facts are audited.
 */
export async function redeemLotterySetupKey(input: LotteryClaim) {
  await connectDb();
  const { keyId, secret } = parseSetupKey(input.setupKey);
  enforceRateLimit(`lottery-redeem:${keyId}`, { limit: 20, windowMs: 60_000 });

  const key = (await SetupKeyModel.findOne({ keyId }).select("+secretHash").lean()) as Doc | null;
  if (!key || !(await verifySecret(String(key.secretHash), secret))) {
    throw new ControlPlaneError(401, "SETUP_KEY_INVALID", "Setup key is invalid");
  }
  if (!OPEN_KEY.includes(String(key.status)) && String(key.status) !== "consumed") {
    throw new ControlPlaneError(409, "SETUP_KEY_CONSUMED", "That setup key is no longer usable");
  }

  const organizationId = String(key.organizationId);
  const storeId = String(key.storeId);
  const workerInstallationId = String(key.workerInstallationId);

  const installation = (await WorkerInstallationModel.findOne({ workerInstallationId }).lean()) as Doc | null;
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found");
  if (installation.product !== LOTTERY) {
    // A StoreDesk key must never set a lottery PC up, or the PC would be handed a tunnel token.
    throw new ControlPlaneError(409, "WRONG_PRODUCT", "That key is not for StoreDesk Lottery");
  }

  // Re-checked at claim, not only at issue: a licence can lapse or the switch can go off in between.
  const { store, coverage } = await loadStore(organizationId, storeId);

  const { credential, replacedPc } = await claimInstallation({
    organizationId,
    storeId,
    workerInstallationId,
    deviceName: input.deviceName,
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    keyId,
    via: "setup_key",
    actorId: "setup_flow"
  });
  await SetupKeyModel.updateOne({ keyId }, { $set: { lastRedeemedAt: new Date() }, $inc: { redeemCount: 1 } });

  return {
    contractVersion: CONTRACT_VERSION,
    workerCredential: credential.plaintext,
    workerCredentialId: credential.credentialId,
    organizationId,
    storeId,
    workerInstallationId,
    replacedPc,
    store: {
      name: String(store.name),
      storeNumber: store.storeNumber ? String(store.storeNumber) : null,
      timeZone: normalizeStoreSettings(store.settings).timeZone
    },
    licence: {
      number: coverage.license ? String(coverage.license.licenseNumber) : null,
      scope: coverage.license ? String(coverage.license.scope) : null,
      status: coverage.license ? String(coverage.license.status) : null
    }
  };
}

/** What the store's lottery PC looks like to an admin. */
export async function lotteryInstallationView(organizationId: string, storeId: string) {
  await connectDb();
  const installation = (await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    ...productFilter(LOTTERY)
  }).lean()) as Doc | null;
  if (!installation) return null;
  const openKey = await SetupKeyModel.countDocuments({
    workerInstallationId: String(installation.workerInstallationId),
    status: { $in: OPEN_KEY }
  });
  return {
    workerInstallationId: String(installation.workerInstallationId),
    status: String(installation.status),
    deviceName: installation.workerName ? String(installation.workerName) : null,
    activatedAt: installation.activatedAt instanceof Date ? installation.activatedAt.toISOString() : null,
    hasOpenKey: openKey > 0
  };
}
