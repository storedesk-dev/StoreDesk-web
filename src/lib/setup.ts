import { z } from "zod";
import { connectDb } from "@/lib/db";
import { SetupKeyModel, WorkerCredentialModel, WorkerInstallationModel } from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { optionalEmail } from "@/lib/http";
import { getEmailProvider, isEmailConfigured } from "@/lib/email-provider";
import { SITE } from "@/lib/site";
import { mintReusableKey, notifyOwnerOfReplacement, OPEN_KEY, resetInstallation } from "@/lib/store-setup-key";
import { requireOrganization } from "@/lib/organizations";
import { installationSummary, requireStore } from "@/lib/tenant-stores";
import { coverageFor, expireLapsedLicenses, licenseProblem, licenseSummary } from "@/lib/licenses";
import { cloudflareConfigured, tunnelView } from "@/lib/tunnel";
import { remoteStatusOf } from "@/lib/remote-status";
import { revokeInstallationsAndNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Store → PC & phones (owner decision 6): the org tag for phones, the setup
 * key for the PC, and the one path that issues keys (P8) — entitlement
 * checked, status `shown` or `sent`, standard errors. Keys are reusable
 * (lib/store-setup-key.ts): they never expire and activate the store's PC
 * again, on this PC or another. Replace PC (P4) cuts the old PC off —
 * credential revoked, tunnel secret rotated — and the same key activates the
 * next PC.
 */

type Doc = Record<string, unknown>;

const PENDING = ["not_installed", "installed", "awaiting_activation"];
const LIVE = ["active", "degraded", "updating", "rollback", "suspended"];

type Blocked = { status: number; code: string; message: string };

async function loadContext(organizationId: string, storeId: string) {
  const org = await requireOrganization(organizationId);
  const store = await requireStore(organizationId, storeId);
  await expireLapsedLicenses({ organizationId });
  const [coverage, installations] = (await Promise.all([
    coverageFor(store, org),
    WorkerInstallationModel.find({ organizationId, storeId }).sort({ createdAt: -1 }).lean()
  ])) as [Awaited<ReturnType<typeof coverageFor>>, Doc[]];
  return { org, store, license: coverage.license, licensingMode: coverage.mode, installations };
}

function whyBlocked(ctx: Awaited<ReturnType<typeof loadContext>>): Blocked | null {
  if (ctx.org.status === "suspended") {
    return { status: 409, code: "ORGANIZATION_SUSPENDED", message: "The organization is suspended; reactivate it first." };
  }
  if (ctx.store.status !== "active") {
    return { status: 409, code: "STORE_SUSPENDED", message: `The store is ${String(ctx.store.status)}; reactivate it first.` };
  }
  // The store's covering license: STORE_UNLICENSED or LICENSE_INACTIVE.
  const problem = licenseProblem(ctx.license, ctx.licensingMode);
  if (problem) return { status: 402, code: problem.code, message: problem.message };
  if (ctx.store.tunnelRotationRequired === true) {
    return {
      status: 409,
      code: "TUNNEL_ROTATION_REQUIRED",
      message:
        "The replaced PC can still serve this store's tunnel. Retry the tunnel to rotate it, then issue a setup key."
    };
  }
  if (cloudflareConfigured() && !ctx.store.tunnelUrl) {
    return {
      status: 428,
      code: "TUNNEL_REQUIRED",
      message: "The store has no tunnel yet, so phones could not reach it. Retry the tunnel first."
    };
  }
  const pending = ctx.installations.find((row) => PENDING.includes(String(row.status)));
  const max = Number(ctx.license?.maxPcsPerStore ?? 1);
  if (!pending && ctx.installations.length >= max) {
    return {
      status: 409,
      code: "INSTALLATION_LIMIT_REACHED",
      message: `This store already has ${ctx.installations.length} PC${ctx.installations.length === 1 ? "" : "s"} (its license allows ${max}). Use "Replace this PC" to set up a new one.`
    };
  }
  return null;
}

const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : value ? new Date(String(value)).toISOString() : null);

/** The key's facts; never its secret (`readable` only says a sealed copy exists). */
function keyView(key: Doc | null) {
  if (!key) return null;
  const reusable = key.reusable === true;
  const expiresAt = key.expiresAt ? new Date(String(key.expiresAt instanceof Date ? key.expiresAt.toISOString() : key.expiresAt)) : null;
  const open = OPEN_KEY.includes(String(key.status));
  return {
    keyId: String(key.keyId),
    status: !reusable && open && expiresAt && expiresAt.getTime() <= Date.now() ? "expired" : String(key.status),
    reusable,
    readable: reusable && Boolean(key.sealedSecret),
    expiresAt: reusable ? null : iso(expiresAt),
    createdAt: iso(key.createdAt),
    lastRedeemedAt: iso(key.lastRedeemedAt ?? key.consumedAt),
    redeemCount: reusable ? Number(key.redeemCount ?? 0) : null,
    contactEmail: key.contactEmail ? String(key.contactEmail) : null,
    deliveryError: key.deliveryError ? String(key.deliveryError) : null
  };
}

export async function getStoreSetup(organizationId: string, storeId: string) {
  const ctx = await loadContext(organizationId, storeId);
  const primary = ctx.installations[0] ?? null;
  const [openKey, latestKey, credential] = await Promise.all([
    // The store's open reusable key first: that is the key the store uses.
    SetupKeyModel.findOne({ organizationId, storeId, reusable: true, status: { $in: OPEN_KEY } })
      .select("+sealedSecret")
      .sort({ createdAt: -1 })
      .lean(),
    SetupKeyModel.findOne({ organizationId, storeId }).sort({ createdAt: -1 }).lean(),
    primary
      ? WorkerCredentialModel.exists({ workerInstallationId: primary.workerInstallationId, status: "active" })
      : Promise.resolve(null)
  ]);
  const blocked = whyBlocked(ctx);
  const tunnel = tunnelView(ctx.store);
  // Can phones reach the store now: "Tunnel healthy" / "Tunnel down since …".
  const remote = await remoteStatusOf(ctx.store);
  return {
    organizationSlug: String(ctx.org.slug),
    organization: {
      organizationId,
      name: String(ctx.org.name),
      slug: String(ctx.org.slug),
      status: String(ctx.org.status)
    },
    store: { storeId, name: String(ctx.store.name), status: String(ctx.store.status) },
    contactEmail: ctx.store.contactEmail ? String(ctx.store.contactEmail) : null,
    installation: primary ? { ...installationSummary(primary)!, credentialActive: Boolean(credential) } : null,
    installations: ctx.installations.map((row) => installationSummary(row)!),
    setupKey: keyView((openKey ?? latestKey) as Doc | null),
    tunnel,
    remote,
    license: licenseSummary(ctx.license),
    licensingMode: ctx.licensingMode,
    keyBlockedReason: blocked?.message ?? null,
    keyBlockedCode: blocked?.code ?? null,
    emailConfigured: isEmailConfigured(),
    warnings: tunnel.status === "not_configured" ? [tunnel.message!] : []
  };
}

export const IssueSetupKeySchema = z
  .object({
    deliver: z.enum(["show", "email"]).default("show"),
    /** Overrides the store's contact e-mail for this key. */
    contactEmail: optionalEmail.optional()
  })
  .strict();
export type IssueSetupKey = z.output<typeof IssueSetupKeySchema>;

export type IssuedSetupKey = {
  keyId: string;
  /** The key itself — only for `deliver: "show"`. Reusable: read it again with `GET …/setup-keys/current`. */
  setupKey?: string;
  status: "shown" | "sent";
  /** Reusable keys never expire. */
  expiresAt: null;
  reusable: true;
  /** False when STORE_SECRET_KEY is not configured: the key works but can't be shown again. */
  readable: boolean;
  sentTo: string | null;
  workerInstallationId: string;
  installation: ReturnType<typeof installationSummary>;
};

export async function issueStoreSetupKey(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  body: IssueSetupKey
): Promise<IssuedSetupKey> {
  const ctx = await loadContext(organizationId, storeId);
  const blocked = whyBlocked(ctx);
  if (blocked) throw new ControlPlaneError(blocked.status, blocked.code, blocked.message);

  const contactEmail = body.contactEmail ?? (ctx.store.contactEmail ? String(ctx.store.contactEmail) : null);
  if (body.deliver === "email") {
    if (!isEmailConfigured()) {
      throw new ControlPlaneError(503, "EMAIL_NOT_CONFIGURED", "E-mail is not configured on this deployment; show the key instead");
    }
    if (!contactEmail) {
      throw new ControlPlaneError(400, "CONTACT_EMAIL_REQUIRED", "The store has no contact e-mail; add one or show the key instead");
    }
  }

  await connectDb();
  let installation = ctx.installations.find((row) => PENDING.includes(String(row.status))) ?? null;
  if (!installation) {
    const workerInstallationId = publicId("winst");
    installation = (
      await WorkerInstallationModel.create({
        organizationId,
        storeId,
        workerInstallationId,
        workerName: `${String(ctx.store.name)} PC`,
        contactEmail: contactEmail ?? SITE.email,
        storeNumberSnapshot: ctx.store.storeNumber,
        addressSnapshot: ctx.store.address,
        status: "awaiting_activation"
      })
    ).toObject() as Doc;
    await auditAdmin(admin, {
      organizationId,
      storeId,
      workerInstallationId,
      action: "installation.create",
      targetType: "worker_installation",
      targetId: workerInstallationId
    });
  } else if (contactEmail && installation.contactEmail !== contactEmail) {
    await WorkerInstallationModel.updateOne(
      { workerInstallationId: installation.workerInstallationId },
      { $set: { contactEmail } }
    );
  }
  const workerInstallationId = String(installation.workerInstallationId);

  // Earlier open keys for the installation are revoked; the new key is reusable.
  const minted = await mintReusableKey({
    organizationId,
    storeId,
    workerInstallationId,
    contactEmail: contactEmail ?? SITE.email,
    status: body.deliver === "show" ? "shown" : "sent",
    deliveryReason: body.deliver === "show" ? "admin_show" : "admin_email",
    adminId: admin.adminId
  });
  const { record } = minted;
  const issued = { keyId: minted.keyId, plaintext: minted.plaintext };

  if (body.deliver === "email") {
    try {
      const delivery = await getEmailProvider().sendSetupKey({
        to: contactEmail!,
        recipientName: String(ctx.store.name),
        organizationName: String(ctx.org.name),
        storeName: String(ctx.store.name),
        setupKey: issued.plaintext,
        expiresAt: null
      });
      record.deliveryProvider = delivery.provider;
      record.deliveryMessageId = delivery.messageId;
      await record.save();
    } catch (error) {
      const reason = (error instanceof Error ? error.message : "delivery failed").slice(0, 300);
      record.status = "delivery_failed";
      record.deliveryError = reason;
      await record.save();
      await auditAdmin(admin, {
        organizationId,
        storeId,
        workerInstallationId,
        action: "setup_key.issue",
        targetType: "setup_key",
        targetId: issued.keyId,
        metadata: { deliver: "email", status: "delivery_failed", sentTo: contactEmail },
        reason
      });
      throw new ControlPlaneError(
        502,
        "SETUP_KEY_DELIVERY_FAILED",
        `The e-mail could not be sent (${reason}). Issue the key to show on screen instead.`,
        true
      );
    }
  }

  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId,
    action: "setup_key.issue",
    targetType: "setup_key",
    targetId: issued.keyId,
    metadata: {
      deliver: body.deliver,
      status: record.status,
      reusable: true,
      readable: minted.readable,
      ...(body.deliver === "email" ? { sentTo: contactEmail } : {})
    }
  });

  const fresh = (await WorkerInstallationModel.findOne({ workerInstallationId }).lean()) as Doc | null;
  return {
    keyId: issued.keyId,
    ...(body.deliver === "show" ? { setupKey: issued.plaintext } : {}),
    status: body.deliver === "show" ? "shown" : "sent",
    expiresAt: null,
    reusable: true,
    readable: minted.readable,
    sentTo: body.deliver === "email" ? contactEmail : null,
    workerInstallationId,
    installation: installationSummary(fresh)
  };
}

export const ReplacePcSchema = z
  .object({ workerInstallationId: z.string().trim().min(1).max(80).optional() })
  .strict();

/**
 * Replace this PC (P4). The old PC holds two things that let it act for the
 * store: its worker credential and the tunnel token. The credential is
 * revoked (the old PC is told and turns sign-in off) and the tunnel secret is
 * rotated, which drops the old PC's tunnel connection. If the tunnel cannot be
 * rotated now (Cloudflare refuses, is not configured, or the tunnel predates
 * stored ids), the store is marked `tunnelRotationRequired` and no setup key
 * is issued until "Retry tunnel" succeeds. Then the installation goes back to
 * `awaiting_activation`: the store's reusable key activates the next PC (an
 * older single-use key still open is cancelled).
 */
export async function replaceStorePc(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  body: z.output<typeof ReplacePcSchema>
) {
  const ctx = await loadContext(organizationId, storeId);
  const candidates = body.workerInstallationId
    ? ctx.installations.filter((row) => row.workerInstallationId === body.workerInstallationId)
    : ctx.installations.filter((row) => LIVE.includes(String(row.status)) || row.workerCredentialId);
  if (candidates.length === 0) {
    throw body.workerInstallationId
      ? new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found")
      : new ControlPlaneError(409, "NO_PC_TO_REPLACE", "This store has no activated PC to replace");
  }
  if (candidates.length > 1) {
    throw new ControlPlaneError(400, "WORKER_INSTALLATION_REQUIRED", "This store has several PCs; say which one to replace");
  }
  const target = candidates[0];
  const workerInstallationId = String(target.workerInstallationId);

  // Only this installation: passing the storeId too would notify every PC of the store.
  const { revoked } = await revokeInstallationsAndNotify({
    organizationId,
    workerInstallationIds: [workerInstallationId],
    reason: "installation.revoke"
  });
  const { tunnelRotated, tunnelError } = await resetInstallation({ organizationId, storeId, workerInstallationId });

  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId,
    action: "installation.replace",
    targetType: "worker_installation",
    targetId: workerInstallationId,
    metadata: {
      previousStatus: target.status,
      credentialsRevoked: revoked,
      tunnelRotated,
      ...(tunnelError ? { tunnelRotationRequired: true, tunnelError } : {})
    }
  });
  // The organization owner hears about every replacement, including this one.
  await notifyOwnerOfReplacement({
    organizationId,
    storeId,
    workerInstallationId,
    by: "admin",
    actorType: "internal_admin",
    actorId: admin.adminId
  }).catch(() => undefined);

  const [fresh, store] = await Promise.all([
    WorkerInstallationModel.findOne({ workerInstallationId }).lean(),
    requireStore(organizationId, storeId)
  ]);
  return { installation: installationSummary(fresh as Doc | null), tunnel: tunnelView(store) };
}
