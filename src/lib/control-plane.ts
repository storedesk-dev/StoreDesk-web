import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  ClientDeviceModel,
  EulaAcceptanceModel,
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import {
  CONTRACT_VERSION,
  ControlPlaneError,
  hashSecret,
  issueRelayKey,
  issueWorkerCredential,
  parseSetupKey,
  publicId,
  safeJson,
  verifySecret,
  enforceRateLimit
} from "@/lib/control-plane-security";
import { abortTransaction, commitTransaction, startTransaction, withSession } from "@/lib/db";
import { DEFAULT_ORG_ROLES } from "@/lib/roles";
import { loadNotifyTargets, notifyInstallations, runAfterResponse, scheduleAppUserNotify, type NotifyTarget } from "@/lib/store-notify";
import { rotateTunnelAfterReplace } from "@/lib/store-setup-key";
import { readRegisterConfig, registerConfigJson } from "@/lib/tenant-stores";
import { writeAudit } from "@/lib/audit";
import { coverageFor, coveringLicense, licenseProblem } from "@/lib/licenses";
import { remoteStatuses } from "@/lib/remote-status";

/**
 * The store-facing half of the control plane: activation (setup-key redeem),
 * bootstrap, enrollment, and the phone's org-tag lookup. The admin half lives
 * in organizations / licenses / tenant-stores / setup / users.
 */

export { DEFAULT_ORG_ROLES };
export { jsonError } from "@/lib/http";
export { writeAudit } from "@/lib/audit";
export { toDnsLabel } from "@/lib/tunnel";

type Doc = Record<string, unknown>;

/** Keys a redeem may consume: issued and not yet used, revoked or expired. */
const REDEEMABLE = ["queued", "shown", "sent", "delivery_failed"];

/**
 * `POST /api/v1/setup-keys/redeem` (P13). The desktop setup wizard only lets
 * the operator activate with all three boxes ticked, so each acknowledgement
 * must be literally `true`; the EULA digest must be a SHA-256 hex digest.
 * Setup asks only for the setup key: `contactEmail`, if a desktop build still
 * sends it, is accepted and ignored — never a reason to refuse. The desktop's
 * single consent (license, privacy, background service) sends all three
 * acknowledgements as `true`. Other unknown fields are ignored.
 *
 * Reusable keys (every key issued since 2026-09-17, lib/store-setup-key.ts)
 * never expire and are not used up: each redeem activates the key's
 * installation on the calling PC. A PC that held it is replaced — its
 * credential revoked in the transaction, a signed notify sent to it, and the
 * tunnel secret rotated so the response carries a token it never had.
 *
 * Safe re-redeem (single-use keys): the same key may be redeemed again within 15 minutes of its
 * first redeem, for the installation it bound, while that installation's live
 * credential is the one this key issued — a PC that crashed or lost the answer
 * after the control plane committed. The first credential is revoked and a
 * fresh credential and relay key are issued (same answer shape), audited
 * `setup_key.re_redeem`. `workerInstallationId`, when sent, must be that
 * installation.
 */
export const RedeemSchema = z.object({
  setupKey: z.string().trim().min(1).max(200),
  acknowledgements: z.object({
    eulaVersion: z.string().trim().min(1).max(40),
    eulaDocumentSha256: z
      .string()
      .trim()
      .regex(/^[a-fA-F0-9]{64}$/, "must be a SHA-256 hex digest"),
    privacyVersion: z.string().trim().min(1).max(40),
    systemAcknowledgementVersion: z.string().trim().min(1).max(40),
    acceptedAt: z
      .string()
      .trim()
      .refine((value) => !Number.isNaN(Date.parse(value)), "must be a date"),
    osAcknowledged: z.literal(true, { message: "must be accepted" }),
    privacyAcknowledged: z.literal(true, { message: "must be accepted" }),
    localDataAcknowledged: z.literal(true, { message: "must be accepted" }),
    /** Ignored (older desktop builds sent it). Any value, or none. */
    contactEmail: z.unknown().optional()
  }),
  installation: z.object({
    platform: z.enum(["windows", "macos", "linux"]),
    workerVersion: z.string().trim().min(1).max(40),
    electronVersion: z.string().trim().min(1).max(40),
    type: z.string().trim().max(40).optional()
  }),
  /** Optional: a PC that knows its installation (a re-redeem) names it. */
  workerInstallationId: z.string().trim().max(80).optional()
});
export type RedeemBody = z.output<typeof RedeemSchema>;

/** Store-facing: these messages reach the store PC and its desktop wizard. */
const STORE_MESSAGES = {
  STORE_UNLICENSED: "This store has no active StoreDesk license.",
  SUBSCRIPTION_INACTIVE: "This store's StoreDesk license isn't active.",
  STORE_SUSPENDED: "This store is suspended in StoreDesk."
} as const;

const invalidKey = () => new ControlPlaneError(401, "SETUP_KEY_INVALID", "Setup key is invalid");
const keyConsumed = () => new ControlPlaneError(409, "SETUP_KEY_CONSUMED", "Setup key has been consumed");
const alreadyBound = () => new ControlPlaneError(409, "INSTALLATION_ALREADY_BOUND", "Installation already bound");

/** Installations a PC is serving: a reusable key redeemed for one replaces that PC. */
const LIVE_INSTALLATION = ["active", "degraded", "updating", "rollback"];

/** How long after its first redeem the same key may be redeemed again (safe re-redeem). */
export const RE_REDEEM_WINDOW_MS = 15 * 60_000;

export async function redeemSetupKey(body: RedeemBody) {
  await connectDb();

  const parsed = parseSetupKey(body.setupKey);
  const correlationId = publicId("corr");
  enforceRateLimit(`redeem:${parsed.keyId}`, {
    limit: 20,
    windowMs: 60_000
  });

  const key = await SetupKeyModel.findOne({ keyId: parsed.keyId })
    .select("+secretHash")
    .lean();
  if (!key || !(await verifySecret(String(key.secretHash), parsed.secret))) {
    throw invalidKey();
  }
  // A reusable key (lib/store-setup-key.ts) never expires and is never used
  // up: it activates the installation again, on this PC or another, until an
  // admin rotates it (a rotated key is revoked and answers 410).
  const reusable = key.reusable === true;
  // A consumed single-use key may come back within the window (safe
  // re-redeem); the installation checks below decide whether this is that case.
  const reRedeem = !reusable && key.status === "consumed";
  if (reusable) {
    if (!REDEEMABLE.includes(String(key.status))) {
      throw new ControlPlaneError(410, "SETUP_KEY_EXPIRED", "Setup key has expired");
    }
  } else if (reRedeem) {
    const consumedAt = key.consumedAt ? new Date(key.consumedAt).getTime() : 0;
    if (!consumedAt || Date.now() - consumedAt > RE_REDEEM_WINDOW_MS) throw keyConsumed();
  } else if (
    key.status === "revoked" ||
    key.status === "expired" ||
    new Date(key.expiresAt).getTime() <= Date.now()
  ) {
    throw new ControlPlaneError(410, "SETUP_KEY_EXPIRED", "Setup key has expired");
  }

  const ack = body.acknowledgements;

  const [org, store] = (await Promise.all([
    OrganizationModel.findOne({ organizationId: key.organizationId }).lean(),
    TenantStoreModel.findOne({ organizationId: key.organizationId, storeId: key.storeId })
      .select("+cloudflareToken")
      .lean()
  ])) as [Doc | null, Doc | null];
  if (!org || !store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");
  // 423 STORE_SUSPENDED (P12), forwarded by the store server to the desktop wizard.
  if (org.status === "suspended" || store.status === "suspended" || store.status === "closed") {
    throw new ControlPlaneError(423, "STORE_SUSPENDED", STORE_MESSAGES.STORE_SUSPENDED);
  }
  // The store's covering license (from the organization's licensing mode)
  // decides, not the one the key was issued under.
  const coverage = await coverageFor(store, org);
  const problem = licenseProblem(coverage.license, coverage.mode);
  if (problem) {
    // 402 STORE_UNLICENSED / SUBSCRIPTION_INACTIVE, forwarded by the store
    // server to the desktop wizard — so the message is store-facing, not the
    // admin console's wording.
    const code = problem.code === "STORE_UNLICENSED" ? "STORE_UNLICENSED" : "SUBSCRIPTION_INACTIVE";
    throw new ControlPlaneError(402, code, STORE_MESSAGES[code]);
  }

  const installation = await WorkerInstallationModel.findOne({
    workerInstallationId: key.workerInstallationId,
    organizationId: key.organizationId,
    storeId: key.storeId
  });
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found");
  if (installation.status === "suspended") {
    throw new ControlPlaneError(423, "STORE_SUSPENDED", STORE_MESSAGES.STORE_SUSPENDED);
  }
  let previousCredentialId: string | null = null;
  // Reusable key: the PC that holds the installation now (if any) is replaced.
  let replacedLivePc = false;
  let replacedTargets: NotifyTarget[] = [];
  if (reusable) {
    // The key decides the installation; a PC that knew another installation is simply set up again.
    previousCredentialId = installation.workerCredentialId ? String(installation.workerCredentialId) : null;
    const current = previousCredentialId
      ? ((await WorkerCredentialModel.findOne({ credentialId: previousCredentialId }).lean()) as Doc | null)
      : null;
    replacedLivePc = LIVE_INSTALLATION.includes(String(installation.status)) && current?.status === "active";
    if (replacedLivePc) {
      // Loaded before its credential is revoked: the notify is signed with that PC's relay key.
      replacedTargets = await loadNotifyTargets({
        organizationId: String(key.organizationId),
        workerInstallationIds: [String(key.workerInstallationId)],
        reason: "installation.revoke"
      }).catch(() => []);
    }
  } else if (reRedeem) {
    // Only the installation this key bound, while the credential this key
    // issued is still its live one.
    if (body.workerInstallationId && body.workerInstallationId !== key.workerInstallationId) throw alreadyBound();
    const current = installation.workerCredentialId
      ? ((await WorkerCredentialModel.findOne({ credentialId: installation.workerCredentialId }).lean()) as Doc | null)
      : null;
    const liveFromThisKey = installation.status === "active" && current?.status === "active" && current.keyId === key.keyId;
    if (!liveFromThisKey) {
      // Bound since by another key: as for any bound installation. Superseded
      // (Replace PC revoked it): the key is simply used.
      if (installation.status === "active" && current?.status === "active") throw alreadyBound();
      throw keyConsumed();
    }
    previousCredentialId = String(current!.credentialId);
  } else if (installation.workerCredentialId && installation.status === "active") {
    throw alreadyBound();
  }

  // ── Atomic activation ────────────────────────────────────────────────────
  // Everything from here commits together or not at all, so a failure never
  // leaves the key burned with no credential issued.
  const session = await startTransaction();

  const credential = issueWorkerCredential();
  const relayKey = issueRelayKey();
  const secretHash = await hashSecret(credential.secret);
  const eulaAcceptanceId = publicId("eula");

  try {
    const consume = reusable
      ? await SetupKeyModel.findOneAndUpdate(
          { keyId: key.keyId, reusable: true, status: { $in: REDEEMABLE } },
          { $set: { lastRedeemedAt: new Date() }, $min: { consumedAt: new Date() }, $inc: { attempts: 1, redeemCount: 1 } },
          { returnDocument: "after", ...withSession(session) }
        )
      : reRedeem
      ? await SetupKeyModel.findOneAndUpdate(
          { keyId: key.keyId, status: "consumed", consumedAt: { $gte: new Date(Date.now() - RE_REDEEM_WINDOW_MS) } },
          { $inc: { attempts: 1 } },
          { returnDocument: "after", ...withSession(session) }
        )
      : await SetupKeyModel.findOneAndUpdate(
          { keyId: key.keyId, status: { $in: REDEEMABLE } },
          { status: "consumed", consumedAt: new Date(), $inc: { attempts: 1 } },
          { returnDocument: "after", ...withSession(session) }
        );
    if (!consume) throw keyConsumed();

    await EulaAcceptanceModel.create(
      [
        {
          eulaAcceptanceId,
          organizationId: key.organizationId,
          storeId: key.storeId,
          workerInstallationId: key.workerInstallationId,
          contactEmail: key.contactEmail,
          eulaVersion: ack.eulaVersion,
          documentSha256: ack.eulaDocumentSha256.toLowerCase(),
          privacyVersion: ack.privacyVersion,
          systemAcknowledgementVersion: ack.systemAcknowledgementVersion,
          osAcknowledged: ack.osAcknowledged,
          privacyAcknowledged: ack.privacyAcknowledged,
          localDataAcknowledged: ack.localDataAcknowledged,
          acceptedAt: new Date(ack.acceptedAt),
          redeemedAt: new Date(),
          correlationId,
          source: "setup_key_redeem"
        }
      ],
      withSession(session)
    );

    // Any previously active credential for this installation is superseded.
    await WorkerCredentialModel.updateMany(
      { workerInstallationId: key.workerInstallationId, status: "active" },
      { status: "revoked", revokedAt: new Date() },
      withSession(session)
    );

    await WorkerCredentialModel.create(
      [
        {
          credentialId: credential.credentialId,
          secretHash,
          relayKey,
          keyId: key.keyId,
          organizationId: key.organizationId,
          storeId: key.storeId,
          workerInstallationId: key.workerInstallationId,
          status: "active",
          issuedAt: new Date()
        }
      ],
      withSession(session)
    );

    const bound = await WorkerInstallationModel.updateOne(
      // A re-redeem, or a reusable key, replaces exactly the credential it found (none: a missing
      // one), so two at once can't both win.
      {
        workerInstallationId: key.workerInstallationId,
        ...(reRedeem || reusable ? { workerCredentialId: previousCredentialId } : {})
      },
      {
        $set: {
          workerCredentialId: credential.credentialId,
          eulaAcceptanceId,
          status: "active",
          ...(reRedeem ? {} : { activatedAt: new Date() }),
          lastSeenAt: new Date(),
          platform: body.installation.platform,
          workerVersion: body.installation.workerVersion,
          electronVersion: body.installation.electronVersion
        },
        // A new PC reports its own bootstrap and LAN address.
        ...(reusable ? { $unset: { firstBootstrapCompletedAt: 1, bootstrapVersion: 1, lanUrl: 1 } } : {})
      },
      withSession(session)
    );
    if (!bound.matchedCount) throw keyConsumed();

    await commitTransaction(session);
  } catch (error) {
    await abortTransaction(session);
    throw error;
  }

  // A replaced PC can still serve the store's tunnel: rotate its secret so only
  // this PC gets the new token (below). Also when an earlier rotation failed.
  let tunnelRotated = false;
  let tunnelError: string | null = null;
  if (reusable && store.tunnelUrl && (replacedLivePc || store.tunnelRotationRequired === true)) {
    ({ tunnelRotated, tunnelError } = await rotateTunnelAfterReplace(String(key.storeId)));
    if (tunnelRotated) {
      const fresh = (await TenantStoreModel.findOne({ storeId: key.storeId }).select("+cloudflareToken").lean()) as Doc | null;
      if (fresh?.cloudflareToken) store.cloudflareToken = fresh.cloudflareToken;
    }
  }
  if (replacedTargets.length) {
    // The old PC pulls, is refused, and wipes its secrets (server fix 10).
    runAfterResponse(() =>
      notifyInstallations(
        { organizationId: String(key.organizationId), workerInstallationIds: [String(key.workerInstallationId)], reason: "installation.revoke" },
        { loadTargets: async () => replacedTargets }
      )
    );
  }

  // Audit is deliberately outside the transaction: a failed audit write must
  // never undo a successful activation.
  await writeAudit({
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    actorType: "system",
    actorId: "setup_flow",
    action: reRedeem ? "setup_key.re_redeem" : "setup_key.redeem",
    targetType: "worker_installation",
    targetId: key.workerInstallationId,
    correlationId,
    metadata: {
      setupKeyId: key.keyId,
      workerCredentialId: credential.credentialId,
      ...(reRedeem || (reusable && previousCredentialId) ? { previousCredentialId } : {}),
      ...(reusable
        ? { reusable: true, replacedPc: replacedLivePc, tunnelRotated, ...(tunnelError ? { tunnelRotationRequired: true, tunnelError } : {}) }
        : {}),
      contactEmail: key.contactEmail
    }
  });

  // The tunnel token and URL live on the Store, not the Installation.
  return {
    contractVersion: CONTRACT_VERSION,
    workerCredential: credential.plaintext,
    workerCredentialId: credential.credentialId,
    relayKey,
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    cloudflareToken: store.cloudflareToken ? String(store.cloudflareToken) : undefined,
    tunnelUrl: store.tunnelUrl ? String(store.tunnelUrl) : undefined,
    configJson: buildEdgeConfigJson(store),
    store: {
      organizationId: key.organizationId,
      storeId: key.storeId,
      workerInstallationId: key.workerInstallationId
    }
  };
}

/**
 * The configJson the store server receives: the register connection only
 * (P17). Roles reach the store through the access sync alone; the register
 * password through its own encrypted channel.
 */
export function buildEdgeConfigJson(store: { configJson?: unknown } | null): string {
  return registerConfigJson(readRegisterConfig(store?.configJson));
}

export async function getBootstrap(
  organizationId: string,
  storeId: string,
  workerInstallationId: string
) {
  await connectDb();
  const installation = await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    workerInstallationId
  }).lean();
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Not found");
  const store = (await TenantStoreModel.findOne({ organizationId, storeId }).lean()) as Record<string, unknown> | null;
  const sub = store ? await coveringLicense(store) : null;
  return safeJson({
    contractVersion: CONTRACT_VERSION,
    organizationId,
    storeId,
    workerInstallationId,
    workerName: installation.workerName,
    contactEmail: installation.contactEmail,
    storeNumberSnapshot: installation.storeNumberSnapshot,
    addressSnapshot: installation.addressSnapshot,
    status: installation.status,
    subscription: sub
      ? {
          status: sub.status,
          entitlementExpiresAt: sub.entitlementExpiresAt,
          offlineGraceDays: sub.offlineGraceDays,
          licenseNumber: sub.licenseNumber,
          scope: sub.scope
        }
      : null,
    protocolRange: { min: 1, max: 1 },
    serverTime: new Date().toISOString(),
    firstBootstrapCompletedAt: installation.firstBootstrapCompletedAt || null
  });
}

export async function completeBootstrap(
  organizationId: string,
  storeId: string,
  workerInstallationId: string,
  body: { bootstrapVersion: string; lanUrl?: string }
) {
  await connectDb();
  const installation = await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    workerInstallationId
  });
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Not found");

  if (body.lanUrl) {
    installation.lanUrl = body.lanUrl;
  }

  if (!installation.firstBootstrapCompletedAt) {
    installation.firstBootstrapCompletedAt = new Date();
    installation.bootstrapVersion = body.bootstrapVersion;
  }
  await installation.save();
  return safeJson({
    contractVersion: CONTRACT_VERSION,
    ready: Boolean(installation.firstBootstrapCompletedAt && installation.workerCredentialId),
    firstBootstrapCompletedAt: installation.firstBootstrapCompletedAt
  });
}

/** `appu_` ids; `apu_` ids were minted by an older add-user path (P16) and still enroll. */
const APP_USER_ID = /^(?:appu|apu)_[a-f0-9]{32}$/;

export async function enrollAppUser(body: {
  enrollmentCredential: string;
  password: string;
  deviceName: string;
  audience: "desktop" | "mobile";
}) {
  await connectDb();
  const [appUserId, secret, extra] = body.enrollmentCredential.split(".");
  if (!appUserId || !APP_USER_ID.test(appUserId) || !secret || extra) {
    throw new ControlPlaneError(401, "ENROLLMENT_INVALID", "Enrollment credential is invalid");
  }
  const user = await AppUserModel.findOne({ appUserId }).select(
    "+enrollmentSecretHash +passwordHash"
  );
  if (
    !user ||
    !user.enrollmentSecretHash ||
    !(await verifySecret(String(user.enrollmentSecretHash), secret))
  ) {
    throw new ControlPlaneError(401, "ENROLLMENT_INVALID", "Enrollment credential is invalid");
  }
  if (user.enrollmentConsumedAt || user.status === "active") {
    throw new ControlPlaneError(409, "ENROLLMENT_CONSUMED", "Enrollment already consumed");
  }
  // Only an invited user who has not set a password yet: a disabled login
  // must never come back to life through an old invitation code.
  if (user.status !== "pending_enrollment") {
    throw new ControlPlaneError(401, "ENROLLMENT_INVALID", "Enrollment credential is invalid");
  }
  if (user.enrollmentExpiresAt && user.enrollmentExpiresAt.getTime() <= Date.now()) {
    throw new ControlPlaneError(410, "ENROLLMENT_EXPIRED", "Enrollment expired");
  }
  user.passwordHash = await hashSecret(body.password);
  user.status = "active";
  user.passwordSetBy = "user";
  user.enrollmentConsumedAt = new Date();
  user.enrollmentSecretHash = undefined;
  user.passwordChangedAt = new Date();
  await user.save();
  await writeAudit({
    actorType: "app_user",
    actorId: appUserId,
    action: "user.enroll",
    targetType: "app_user",
    targetId: appUserId
  });
  // The new password reaches the user's stores with their next access pull.
  scheduleAppUserNotify(appUserId, "app_user.enroll");

  const deviceId = publicId("dev");
  await ClientDeviceModel.create({
    deviceId,
    appUserId,
    audience: body.audience,
    deviceName: body.deviceName.trim(),
    status: "active",
    lastSeenAt: new Date()
  });

  return {
    contractVersion: CONTRACT_VERSION,
    appUserId,
    deviceId,
    assignments: await assignmentSummaries(appUserId)
  };
}

/** Where the user can now sign in: organization, store (or every store) and role. */
async function assignmentSummaries(appUserId: string) {
  const assignments = (await UserAssignmentModel.find({ appUserId, status: "active" }).lean()) as Doc[];
  const [orgs, stores] = (await Promise.all([
    OrganizationModel.find({ organizationId: { $in: assignments.map((a) => a.organizationId) } }).lean(),
    TenantStoreModel.find({ storeId: { $in: assignments.map((a) => a.storeId).filter(Boolean) } }).lean()
  ])) as [Doc[], Doc[]];
  const orgName = new Map(orgs.map((org) => [String(org.organizationId), String(org.name)]));
  const store = new Map(stores.map((row) => [String(row.storeId), row]));
  return assignments.map((assignment) => {
    const row = assignment.storeId ? store.get(String(assignment.storeId)) : undefined;
    return {
      assignmentId: String(assignment.assignmentId),
      organizationId: String(assignment.organizationId),
      organizationName: orgName.get(String(assignment.organizationId)) ?? null,
      storeId: assignment.storeId ? String(assignment.storeId) : null,
      storeName: row ? String(row.name) : null,
      role: String(assignment.role),
      tunnelUrl: row?.tunnelUrl ? String(row.tunnelUrl) : null
    };
  });
}

/**
 * Lookup accepts any stored slug, including ones older builds wrote before the
 * org-tag rule (lib/organizations.ts ORG_SLUG); the fallback slug was an
 * organization id, hence `_`.
 */
const ORGANIZATION_SLUG = /^[a-z0-9][a-z0-9._-]{0,99}$/;

export function normalizeOrganizationSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  return ORGANIZATION_SLUG.test(slug) ? slug : null;
}

async function activeOrganizationBySlug(rawSlug: string) {
  const slug = normalizeOrganizationSlug(rawSlug);
  if (!slug) throw new ControlPlaneError(400, "REQUEST_INVALID", "Organization is invalid");
  await connectDb();
  // A suspended organization is not found (P12).
  const org = await OrganizationModel.findOne({ slug, status: "active" }).lean();
  if (!org) {
    throw new ControlPlaneError(404, "ORGANIZATION_NOT_FOUND", "No organization matches that name");
  }
  return org;
}

/**
 * The phone's first screen: the user types the org tag and the app saves the
 * answer, so it knows where each store's server is before anyone signs in.
 * Public and rate-limited, so it carries only public facts: the organization's
 * name and, per active store, its name, id, tunnel URL (a public hostname) and
 * `remote: {status: "online" | "offline" | "unknown", since}` — whether phones
 * can reach it now, and since when (rounded to the minute). An offline store
 * is still listed. Suspended organizations and stores are left out.
 */
export async function lookupOrganization(rawSlug: string) {
  const org = await activeOrganizationBySlug(rawSlug);
  const stores = (await TenantStoreModel.find({
    organizationId: org.organizationId,
    status: "active"
  })
    .sort({ name: 1 })
    .lean()) as Doc[];
  const remote = await remoteStatuses(stores);
  // Whether a store PC has been activated: the phone shows a store that is still waiting for its PC as
  // disabled ("Not set up yet") instead of hiding it.
  const installations = (await WorkerInstallationModel.find({ storeId: { $in: stores.map((s) => String(s.storeId)) } })
    .select({ storeId: 1, status: 1 })
    .lean()) as Doc[];
  const setupOf = (storeId: string): "active" | "awaiting_activation" | "none" => {
    const mine = installations.filter((i) => String(i.storeId) === storeId).map((i) => String(i.status));
    if (mine.includes("active")) return "active";
    if (mine.includes("awaiting_activation")) return "awaiting_activation";
    return "none";
  };
  return {
    contractVersion: CONTRACT_VERSION,
    organization: { slug: String(org.slug), name: String(org.name) },
    stores: stores.map((store) => ({
      storeId: String(store.storeId),
      name: String(store.name),
      storeNumber: store.storeNumber ? String(store.storeNumber) : null,
      tunnelUrl: store.tunnelUrl ? String(store.tunnelUrl) : null,
      setup: setupOf(String(store.storeId)),
      remote: remote.get(String(store.storeId)) ?? { status: "unknown" as const, since: null }
    }))
  };
}
