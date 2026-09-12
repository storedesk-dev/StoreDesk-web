import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  SetupKeyModel,
  SubscriptionModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError, hashSecret, issueSetupKey, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { optionalEmail } from "@/lib/http";
import { getEmailProvider, isEmailConfigured } from "@/lib/email-provider";
import { PLANS, SITE } from "@/lib/site";
import { requireOrganization } from "@/lib/organizations";
import { installationSummary, requireStore } from "@/lib/tenant-stores";
import { entitlementProblem, expireLapsedSubscriptions, subscriptionView } from "@/lib/subscriptions";
import { cloudflareConfigured, tunnelView } from "@/lib/tunnel";
import { revokeInstallationsAndNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Store → PC & phones (owner decision 6): the org tag for phones, the setup
 * key for the PC, and the one path that issues keys (P8) — entitlement
 * checked, status `shown` or `sent`, standard errors. Replace PC (P4) resets
 * an installation so a new key can activate a new PC.
 */

type Doc = Record<string, unknown>;

const SETUP_KEY_TTL_MS = PLANS.setupKeyHours * 60 * 60 * 1000;
const PENDING = ["not_installed", "installed", "awaiting_activation"];
const LIVE = ["active", "degraded", "updating", "rollback", "suspended"];
const OPEN_KEY = ["queued", "shown", "sent", "delivery_failed"];

type Blocked = { status: number; code: string; message: string };

async function loadContext(organizationId: string, storeId: string) {
  const org = await requireOrganization(organizationId);
  const store = await requireStore(organizationId, storeId);
  await expireLapsedSubscriptions({ organizationId, subscriptionId: store.subscriptionId });
  const [subscription, installations] = (await Promise.all([
    SubscriptionModel.findOne({ organizationId, subscriptionId: store.subscriptionId }).lean(),
    WorkerInstallationModel.find({ organizationId, storeId }).sort({ createdAt: -1 }).lean()
  ])) as [Doc | null, Doc[]];
  return { org, store, subscription, installations };
}

function whyBlocked(ctx: Awaited<ReturnType<typeof loadContext>>): Blocked | null {
  if (ctx.org.status === "suspended") {
    return { status: 409, code: "ORGANIZATION_SUSPENDED", message: "The organization is suspended; reactivate it first." };
  }
  if (ctx.store.status !== "active") {
    return { status: 409, code: "STORE_SUSPENDED", message: `The store is ${String(ctx.store.status)}; reactivate it first.` };
  }
  const problem = entitlementProblem(ctx.subscription);
  if (problem) return { status: 402, code: "SUBSCRIPTION_INACTIVE", message: problem };
  if (cloudflareConfigured() && !ctx.store.tunnelUrl) {
    return {
      status: 428,
      code: "TUNNEL_REQUIRED",
      message: "The store has no tunnel yet, so phones could not reach it. Retry the tunnel first."
    };
  }
  const pending = ctx.installations.find((row) => PENDING.includes(String(row.status)));
  const max = Number(ctx.subscription?.maxWorkerInstallations ?? 1);
  if (!pending && ctx.installations.length >= max) {
    return {
      status: 409,
      code: "INSTALLATION_LIMIT_REACHED",
      message: `This store already has ${ctx.installations.length} PC${ctx.installations.length === 1 ? "" : "s"} (the subscription allows ${max}). Use "Replace this PC" to set up a new one.`
    };
  }
  return null;
}

function keyView(key: Doc | null) {
  if (!key) return null;
  const expiresAt = key.expiresAt instanceof Date ? key.expiresAt : new Date(String(key.expiresAt));
  const open = OPEN_KEY.includes(String(key.status));
  return {
    keyId: String(key.keyId),
    status: open && expiresAt.getTime() <= Date.now() ? "expired" : String(key.status),
    expiresAt: expiresAt.toISOString(),
    createdAt: key.createdAt instanceof Date ? key.createdAt.toISOString() : null,
    contactEmail: key.contactEmail ? String(key.contactEmail) : null,
    deliveryError: key.deliveryError ? String(key.deliveryError) : null
  };
}

export async function getStoreSetup(organizationId: string, storeId: string) {
  const ctx = await loadContext(organizationId, storeId);
  const primary = ctx.installations[0] ?? null;
  const [latestKey, credential] = await Promise.all([
    SetupKeyModel.findOne({ organizationId, storeId }).sort({ createdAt: -1 }).lean(),
    primary
      ? WorkerCredentialModel.exists({ workerInstallationId: primary.workerInstallationId, status: "active" })
      : Promise.resolve(null)
  ]);
  const blocked = whyBlocked(ctx);
  const tunnel = tunnelView(ctx.store);
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
    setupKey: keyView(latestKey as Doc | null),
    tunnel,
    subscription: ctx.subscription ? subscriptionView(ctx.subscription) : null,
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
  /** The key itself — only for `deliver: "show"`, and only in this response. */
  setupKey?: string;
  status: "shown" | "sent";
  expiresAt: string;
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
        subscriptionId: ctx.store.subscriptionId,
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

  await SetupKeyModel.updateMany(
    { workerInstallationId, status: { $in: OPEN_KEY } },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
  const issued = issueSetupKey();
  const expiresAt = new Date(Date.now() + SETUP_KEY_TTL_MS);
  const record = await SetupKeyModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    subscriptionId: ctx.store.subscriptionId,
    keyId: issued.keyId,
    secretHash: await hashSecret(issued.secret),
    contactEmail: contactEmail ?? SITE.email,
    status: body.deliver === "show" ? "shown" : "sent",
    expiresAt,
    deliveryReason: body.deliver === "show" ? "admin_show" : "admin_email",
    idempotencyKey: publicId("idem"),
    createdByAdminId: admin.adminId
  });

  if (body.deliver === "email") {
    try {
      const delivery = await getEmailProvider().sendSetupKey({
        to: contactEmail!,
        recipientName: String(ctx.store.name),
        organizationName: String(ctx.org.name),
        storeName: String(ctx.store.name),
        setupKey: issued.plaintext,
        expiresAt
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
    metadata: { deliver: body.deliver, status: record.status, ...(body.deliver === "email" ? { sentTo: contactEmail } : {}) }
  });

  const fresh = (await WorkerInstallationModel.findOne({ workerInstallationId }).lean()) as Doc | null;
  return {
    keyId: issued.keyId,
    ...(body.deliver === "show" ? { setupKey: issued.plaintext } : {}),
    status: body.deliver === "show" ? "shown" : "sent",
    expiresAt: expiresAt.toISOString(),
    sentTo: body.deliver === "email" ? contactEmail : null,
    workerInstallationId,
    installation: installationSummary(fresh)
  };
}

export const ReplacePcSchema = z
  .object({ workerInstallationId: z.string().trim().min(1).max(80).optional() })
  .strict();

/**
 * Replace this PC (P4): revoke the installation's credential and tell the old
 * PC (its next pull gets 401 and it turns sign-in off), revoke unused keys,
 * and put the installation back to `awaiting_activation` so the next key
 * redeems on a new PC.
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
  await SetupKeyModel.updateMany(
    { workerInstallationId, status: { $in: OPEN_KEY } },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
  await WorkerInstallationModel.updateOne(
    { workerInstallationId },
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
  await auditAdmin(admin, {
    organizationId,
    storeId,
    workerInstallationId,
    action: "installation.replace",
    targetType: "worker_installation",
    targetId: workerInstallationId,
    metadata: { previousStatus: target.status, credentialsRevoked: revoked }
  });
  const fresh = (await WorkerInstallationModel.findOne({ workerInstallationId }).lean()) as Doc | null;
  return { installation: installationSummary(fresh) };
}
