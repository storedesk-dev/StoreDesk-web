import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError, enforceRateLimit, hashSecret, issueSetupKey, publicId } from "@/lib/control-plane-security";
import { auditAdmin, writeAudit, type AuditInput } from "@/lib/audit";
import { isStoreSecretConfigured, openStoreSecret, sealStoreSecret } from "@/lib/store-secrets";
import { getEmailProvider, isEmailConfigured } from "@/lib/email-provider";
import { ORG_ADMIN_ROLE_ID } from "@/lib/roles";
import { requireStore } from "@/lib/tenant-stores";
import { rotateStoreTunnel } from "@/lib/tunnel";
import { SITE } from "@/lib/site";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * The store's reusable setup key and "Replace PC" (owner decision
 * 2026-09-17): "I want the key to be usable again … you can install it again
 * on the same PC and it works, or a different PC and it works."
 *
 * - One reusable key per installation, open until rotated. It never expires
 *   and can be read back at any time, so the owner never has to keep it.
 * - **Every successful redeem rotates it** (lib/control-plane.ts, redeem): the
 *   key that was shown is consumed and the next one is minted in the same
 *   transaction. The PC that just activated, and an admin, can read the new
 *   key straight away, so the owner's flow is unchanged — but a key somebody
 *   saw once stops working the moment it is used.
 * - Its secret is argon2id-hashed like every key, and also sealed with
 *   STORE_SECRET_KEY so it can be read again: by an internal admin (audited
 *   `setup_key.reveal`, rate-limited) and by the store's own PC with its
 *   worker credential, for the desktop's "Replace PC". Reading it on the store
 *   PC needs an **organization admin** signed in, not merely the StoreDesk
 *   Service page (audited, actor worker, `metadata.appUserId`).
 * - Redeeming it on a PC while another PC is live **no longer replaces that PC
 *   silently**. The installation must have released itself (Replace PC ran, so
 *   it is `awaiting_activation`), or an internal admin must have allowed the
 *   next activation to replace it (`allowPcReplacement`, 24 h, audited).
 *   Otherwise the redeem is refused with `PC_ALREADY_ACTIVE`.
 * - A PC can give the installation up itself (`releaseInstallation`): its
 *   credential is revoked, the tunnel secret rotated and the installation goes
 *   back to `awaiting_activation`; the key stays valid.
 * - Rotating the key (admin) revokes it and issues a new one; the PC that is
 *   running keeps working.
 * - The organization owner is e-mailed whenever an installation is replaced
 *   (`notifyOwnerOfReplacement`), and the notice is audited either way.
 */

type Doc = Record<string, unknown>;

/** Keys that can still be redeemed. */
export const OPEN_KEY = ["queued", "shown", "sent", "delivery_failed"];

export const SETUP_KEY_NOT_FOUND = "SETUP_KEY_NOT_FOUND";
export const SETUP_KEY_NOT_READABLE = "SETUP_KEY_NOT_READABLE";

export type PreparedKey = {
  keyId: string;
  plaintext: string;
  readable: boolean;
  /** The row to insert — separately, so a redeem can write it inside its own transaction. */
  doc: Record<string, unknown>;
};

/**
 * A reusable key, issued, argon2id-hashed and sealed, but not stored yet. The
 * hashing is deliberately done by the caller *before* it opens a transaction:
 * argon2id takes long enough that hashing inside one would hold it open.
 */
export async function prepareReusableKey(input: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  contactEmail: string;
  status: "shown" | "sent";
  deliveryReason: string;
  adminId?: string;
}): Promise<PreparedKey> {
  const issued = issueSetupKey();
  const readable = isStoreSecretConfigured();
  return {
    keyId: issued.keyId,
    plaintext: issued.plaintext,
    readable,
    doc: {
      organizationId: input.organizationId,
      storeId: input.storeId,
      workerInstallationId: input.workerInstallationId,
      keyId: issued.keyId,
      secretHash: await hashSecret(issued.secret),
      reusable: true,
      ...(readable ? { sealedSecret: sealStoreSecret(issued.plaintext) } : {}),
      contactEmail: input.contactEmail,
      status: input.status,
      deliveryReason: input.deliveryReason,
      idempotencyKey: publicId("idem"),
      ...(input.adminId ? { createdByAdminId: input.adminId } : {})
    }
  };
}

/** Mint a reusable key for an installation. Earlier open keys of that installation are revoked first. */
export async function mintReusableKey(input: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  contactEmail: string;
  status: "shown" | "sent";
  deliveryReason: string;
  adminId: string;
}) {
  await connectDb();
  await SetupKeyModel.updateMany(
    { workerInstallationId: input.workerInstallationId, status: { $in: OPEN_KEY } },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
  const prepared = await prepareReusableKey(input);
  const record = await SetupKeyModel.create(prepared.doc);
  return { record, keyId: prepared.keyId, plaintext: prepared.plaintext, readable: prepared.readable };
}

/** The installation's open reusable key with its sealed secret, newest first. */
async function openReusableKey(filter: { organizationId: string; storeId: string; workerInstallationId?: string }) {
  await connectDb();
  return (await SetupKeyModel.findOne({ ...filter, reusable: true, status: { $in: OPEN_KEY } })
    .select("+sealedSecret")
    .sort({ createdAt: -1 })
    .lean()) as Doc | null;
}

/** The plaintext key, or null when it was issued without STORE_SECRET_KEY or that key has changed. */
function readKey(key: Doc): string | null {
  const plaintext = openStoreSecret(key.sealedSecret ? String(key.sealedSecret) : null);
  // A sealed value that opens to another key's text is never shown.
  return plaintext && plaintext.startsWith(`${String(key.keyId)}.`) ? plaintext : null;
}

/**
 * `GET …/stores/:storeId/setup-keys/current` (internal admin): the store's
 * reusable key, readable any time. 10 a minute per admin; audited.
 */
export async function revealStoreSetupKey(admin: InternalAdminActor, storeId: string) {
  enforceRateLimit(`setup-key-reveal:${admin.adminId}`, { limit: 10, windowMs: 60_000, code: "RATE_LIMITED" });
  const organizationId = String((await requireStore(storeId)).organizationId);
  const key = await openReusableKey({ organizationId, storeId });
  if (!key) {
    throw new ControlPlaneError(404, SETUP_KEY_NOT_FOUND, "This store has no reusable setup key yet. Issue or rotate one.");
  }
  const setupKey = readKey(key);
  if (!setupKey) {
    throw new ControlPlaneError(
      409,
      SETUP_KEY_NOT_READABLE,
      "This key can't be shown again (it was issued without STORE_SECRET_KEY, or that secret changed). Rotate it to get a readable key."
    );
  }
  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId: String(key.workerInstallationId),
    action: "setup_key.reveal",
    targetType: "setup_key",
    targetId: String(key.keyId)
  });
  return { keyId: String(key.keyId), setupKey, workerInstallationId: String(key.workerInstallationId) };
}

export const RotateSetupKeySchema = z
  .object({ workerInstallationId: z.string().trim().min(1).max(80).optional() })
  .strict();

/**
 * `POST …/stores/:storeId/setup-keys/rotate` (internal admin): the old key
 * stops working and a new reusable key is returned (and stays readable). The
 * PC that is running keeps working; only activation needs the new key. Also
 * how a store activated with an older single-use key gets a reusable one.
 */
export async function rotateStoreSetupKey(
  admin: InternalAdminActor,
  storeId: string,
  body: z.output<typeof RotateSetupKeySchema>
) {
  const store = await requireStore(storeId);
  const organizationId = String(store.organizationId);
  const installations = (await WorkerInstallationModel.find({ organizationId, storeId }).sort({ createdAt: -1 }).lean()) as Doc[];
  const candidates = body.workerInstallationId
    ? installations.filter((row) => row.workerInstallationId === body.workerInstallationId)
    : installations;
  if (candidates.length === 0) {
    throw body.workerInstallationId
      ? new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found")
      : new ControlPlaneError(409, "NO_PC_TO_REPLACE", "This store has no PC yet; issue a setup key first");
  }
  if (candidates.length > 1) {
    throw new ControlPlaneError(400, "WORKER_INSTALLATION_REQUIRED", "This store has several PCs; say which one's key to rotate");
  }
  const target = candidates[0];
  const workerInstallationId = String(target.workerInstallationId);
  const previous = await openReusableKey({ organizationId, storeId, workerInstallationId });
  const minted = await mintReusableKey({
    organizationId,
    storeId,
    workerInstallationId,
    contactEmail: String(target.contactEmail ?? store.contactEmail ?? SITE.email),
    status: "shown",
    deliveryReason: "admin_rotate",
    adminId: admin.adminId
  });
  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId,
    action: "setup_key.rotate",
    targetType: "setup_key",
    targetId: minted.keyId,
    metadata: { previousKeyId: previous ? String(previous.keyId) : null, readable: minted.readable }
  });
  return { keyId: minted.keyId, setupKey: minted.plaintext, readable: minted.readable, workerInstallationId };
}

export const NOT_ORG_ADMIN = "NOT_ORG_ADMIN";

/** The header the store PC names the signed-in app user in (a GET has no body). */
export const APP_USER_HEADER = "x-storedesk-app-user";

/**
 * Whether this app user is an organization admin of `organizationId` — the
 * owner-level check. An assignment with no `storeId` covers every store of the
 * organization; a store-scoped one must name this store.
 */
export async function isOrganizationAdmin(appUserId: string, organizationId: string, storeId: string): Promise<boolean> {
  await connectDb();
  const assignment = await UserAssignmentModel.findOne({
    appUserId,
    organizationId,
    status: "active",
    role: ORG_ADMIN_ROLE_ID,
    $or: [{ storeId }, { storeId: null }, { storeId: { $exists: false } }]
  }).lean();
  return Boolean(assignment);
}

/**
 * `GET /api/v1/edge/setup-key` (worker credential): the calling installation's
 * own reusable key, for the desktop's "Replace PC". Store-facing messages;
 * 10 a minute per installation; audited with the worker as actor and the
 * person who asked in `metadata.appUserId`.
 *
 * The worker credential alone is not enough. The key lets its holder take the
 * store over, so the store PC must name the signed-in app user, and that user
 * must be an **organization admin** — the store PC's own `manageWorker` page
 * check is a role a store manager can have.
 */
export async function workerSetupKey(
  worker: { organizationId: string; storeId: string; workerInstallationId: string; credentialId: string },
  appUserId?: string | null
) {
  enforceRateLimit(`setup-key-worker:${worker.workerInstallationId}`, { limit: 10, windowMs: 60_000, code: "RATE_LIMITED" });
  const actor = appUserId?.trim();
  if (!actor || !(await isOrganizationAdmin(actor, worker.organizationId, worker.storeId))) {
    throw new ControlPlaneError(403, NOT_ORG_ADMIN, "Only an organization admin can read this store's setup key.");
  }
  const key = await openReusableKey({
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId: worker.workerInstallationId
  });
  if (!key) {
    throw new ControlPlaneError(404, SETUP_KEY_NOT_FOUND, "This store has no reusable setup key yet. Ask StoreDesk for one.");
  }
  const setupKey = readKey(key);
  if (!setupKey) {
    throw new ControlPlaneError(409, SETUP_KEY_NOT_READABLE, "This store's setup key can't be shown. Ask StoreDesk for a new one.");
  }
  await writeAudit({
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId: worker.workerInstallationId,
    actorType: "worker",
    actorId: worker.credentialId,
    action: "setup_key.reveal",
    targetType: "setup_key",
    targetId: String(key.keyId),
    metadata: { appUserId: actor }
  });
  return { keyId: String(key.keyId), setupKey };
}

// ── "Allow the next activation to replace the running PC" ────────────────────

/** How long an admin's approval of a replacement stays good. */
export const REPLACEMENT_APPROVAL_MS = 24 * 60 * 60 * 1000;

export const PC_ALREADY_ACTIVE = "PC_ALREADY_ACTIVE";

/** What the setup wizard shows when a key is redeemed against a PC that is still running. */
export const PC_ALREADY_ACTIVE_MESSAGE =
  "This store already has an active PC. Use Replace PC on it, or ask an admin to allow a replacement.";

export function pcAlreadyActive(): ControlPlaneError {
  return new ControlPlaneError(409, PC_ALREADY_ACTIVE, PC_ALREADY_ACTIVE_MESSAGE);
}

/**
 * `POST …/stores/:storeId/replacement-approval` (internal admin): let the next
 * activation replace the PC that is running now. Expires in 24 hours, is used
 * up by the activation that takes it, and is audited.
 */
export async function allowPcReplacement(admin: InternalAdminActor, storeId: string) {
  const organizationId = String((await requireStore(storeId)).organizationId);
  const allowedUntil = new Date(Date.now() + REPLACEMENT_APPROVAL_MS);
  await TenantStoreModel.updateOne(
    { organizationId, storeId },
    { $set: { replacementAllowedUntil: allowedUntil, replacementAllowedByAdminId: admin.adminId } }
  );
  await auditAdmin(admin, {
    organizationId,
    storeId,
    action: "installation.replacement_allowed",
    targetType: "store",
    targetId: storeId,
    metadata: { allowedUntil: allowedUntil.toISOString(), expiresInMs: REPLACEMENT_APPROVAL_MS }
  });
  return { allowed: true, allowedUntil: allowedUntil.toISOString() };
}

/** The store's live replacement approval, or null. */
export async function replacementApproval(storeId: string): Promise<{ allowedUntil: Date; adminId: string | null } | null> {
  await connectDb();
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Doc | null;
  const until = store?.replacementAllowedUntil ? new Date(String(store.replacementAllowedUntil)) : null;
  if (!until || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) return null;
  return { allowedUntil: until, adminId: store?.replacementAllowedByAdminId ? String(store.replacementAllowedByAdminId) : null };
}

/** Spend the approval: it allows the *next* activation, not every later one. */
export async function clearReplacementApproval(storeId: string): Promise<void> {
  await connectDb();
  await TenantStoreModel.updateOne(
    { storeId },
    { $unset: { replacementAllowedUntil: 1, replacementAllowedByAdminId: 1 } }
  );
}

// ── Telling the organization owner ───────────────────────────────────────────

/**
 * E-mail the organization owner that a store's PC was replaced, and audit the
 * notice either way (`installation.replaced_notice`) so there is a record even
 * where e-mail is not configured. Best effort: a replacement is never undone
 * because a message could not be sent.
 */
export async function notifyOwnerOfReplacement(input: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  /** "activation" (a setup key redeemed on another PC) or "admin" (Replace PC in the console). */
  by: "activation" | "admin";
  actorType: AuditInput["actorType"];
  actorId: string;
  appUserId?: string | null;
}): Promise<void> {
  await connectDb();
  const [org, store] = (await Promise.all([
    OrganizationModel.findOne({ organizationId: input.organizationId }).lean(),
    TenantStoreModel.findOne({ storeId: input.storeId }).lean()
  ])) as [Doc | null, Doc | null];
  const to = String(org?.billingEmail ?? store?.contactEmail ?? "").trim();
  const organizationName = String(org?.name ?? "your organization");
  const storeName = String(store?.name ?? input.storeId);

  let delivered = false;
  let error: string | null = null;
  if (!to) {
    error = "the organization has no owner e-mail address";
  } else if (!isEmailConfigured()) {
    error = "e-mail is not configured on this deployment";
  } else {
    try {
      await getEmailProvider().sendInstallationReplaced({ to, organizationName, storeName, by: input.by, at: new Date() });
      delivered = true;
    } catch (failure) {
      error = (failure instanceof Error ? failure.message : "delivery failed").slice(0, 300);
    }
  }

  await writeAudit({
    organizationId: input.organizationId,
    storeId: input.storeId,
    workerInstallationId: input.workerInstallationId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: "installation.replaced_notice",
    targetType: "worker_installation",
    targetId: input.workerInstallationId,
    metadata: {
      by: input.by,
      notifiedOwner: delivered,
      ...(to ? { sentTo: to } : {}),
      ...(error ? { deliveryError: error } : {}),
      ...(input.appUserId ? { appUserId: input.appUserId } : {})
    }
  });
}

/**
 * Put an installation back to `awaiting_activation` after its PC was taken out
 * of service, and rotate the store's tunnel secret so that PC's cloudflared
 * can no longer serve the store. The caller revokes the credential. Open
 * single-use keys are cancelled; the reusable key stays valid. When the tunnel
 * can't be rotated now the store is marked `tunnelRotationRequired`.
 */
export async function resetInstallation(input: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  /** Reset only while this credential still holds the installation (a PC releasing itself). */
  workerCredentialId?: string;
}): Promise<{ reset: boolean; tunnelRotated: boolean; tunnelError: string | null }> {
  await connectDb();
  const reset = await WorkerInstallationModel.updateOne(
    {
      organizationId: input.organizationId,
      storeId: input.storeId,
      workerInstallationId: input.workerInstallationId,
      ...(input.workerCredentialId ? { workerCredentialId: input.workerCredentialId } : {})
    },
    {
      $set: { status: "awaiting_activation" },
      $unset: {
        workerCredentialId: 1,
        activatedAt: 1,
        firstBootstrapCompletedAt: 1,
        bootstrapVersion: 1,
        lastSeenAt: 1,
        lanUrl: 1,
        eulaAcceptanceId: 1,
        platform: 1,
        workerVersion: 1,
        electronVersion: 1
      }
    }
  );
  // Another PC redeemed the key meanwhile: it holds the installation, and its tunnel token stays valid.
  if (input.workerCredentialId && !reset.matchedCount) return { reset: false, tunnelRotated: false, tunnelError: null };
  await SetupKeyModel.updateMany(
    { workerInstallationId: input.workerInstallationId, reusable: { $ne: true }, status: { $in: OPEN_KEY } },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
  return { reset: true, ...(await rotateTunnelAfterReplace(input.storeId)) };
}

/** Rotate the tunnel secret a replaced PC holds; on failure mark the store so "Retry tunnel" does it. */
export async function rotateTunnelAfterReplace(storeId: string): Promise<{ tunnelRotated: boolean; tunnelError: string | null }> {
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Doc | null;
  if (!store?.tunnelUrl) return { tunnelRotated: false, tunnelError: null };
  const outcome = store.tunnelId ? await rotateStoreTunnel(storeId, String(store.tunnelId)) : null;
  if (outcome?.status === "ok") return { tunnelRotated: true, tunnelError: null };
  const tunnelError = outcome?.message ?? "The tunnel predates rotation support; Retry tunnel replaces it.";
  await TenantStoreModel.updateOne({ storeId }, { $set: { tunnelRotationRequired: true } });
  return { tunnelRotated: false, tunnelError };
}

export const ReleaseInstallationSchema = z
  .object({
    confirm: z.literal("REPLACE_PC"),
    /** Who pressed Replace PC on the store PC; stored as the actor of the release. */
    appUserId: z.string().trim().min(1).max(80).optional()
  })
  .strict();

/**
 * `POST /api/v1/edge/installation/release` (worker credential): the store PC
 * gives its installation up ("Replace PC" in the desktop app). Its credential
 * is revoked (so this call works once), the tunnel secret rotated and the
 * installation reset; the store's reusable key stays valid for the next PC.
 * No secret in the answer. `appUserId` names the person, not just the PC.
 */
export async function releaseInstallation(
  worker: { organizationId: string; storeId: string; workerInstallationId: string; credentialId: string },
  appUserId?: string | null
) {
  await connectDb();
  // The calling PC's own credential only: a PC that redeemed the key since holds the installation
  // with a newer credential, and this release must not cut it off.
  const revoked = await WorkerCredentialModel.updateMany(
    {
      credentialId: worker.credentialId,
      workerInstallationId: worker.workerInstallationId,
      organizationId: worker.organizationId,
      status: { $in: ["active", "overlap"] }
    },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
  const { reset, tunnelRotated, tunnelError } = await resetInstallation({ ...worker, workerCredentialId: worker.credentialId });
  const key = await SetupKeyModel.exists({
    workerInstallationId: worker.workerInstallationId,
    reusable: true,
    status: { $in: OPEN_KEY }
  });
  await writeAudit({
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId: worker.workerInstallationId,
    actorType: "worker",
    actorId: worker.credentialId,
    action: "installation.release",
    targetType: "worker_installation",
    targetId: worker.workerInstallationId,
    metadata: {
      credentialsRevoked: Number(revoked.modifiedCount ?? 0),
      ...(reset ? {} : { replacedMeanwhile: true }),
      tunnelRotated,
      reusableKey: Boolean(key),
      ...(appUserId ? { appUserId } : {}),
      ...(tunnelError ? { tunnelRotationRequired: true, tunnelError } : {})
    }
  });
  return { released: true, tunnelRotated, reusableKey: Boolean(key) };
}
