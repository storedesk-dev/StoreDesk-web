import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { provisionCloudflareTunnel } from "./cloudflare";
import {
  AppUserModel,
  AuditEventModel,
  ClientDeviceModel,
  ClientRefreshCredentialModel,
  ClientSessionModel,
  EulaAcceptanceModel,
  OrganizationModel,
  SetupKeyModel,
  SubscriptionModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import {
  CONTRACT_VERSION,
  ControlPlaneError,
  enforceRateLimit,
  hashSecret,
  issueSetupKey,
  parseSetupKey,
  publicId,
  randomSecret,
  safeJson,
  signRelaySession,
  verifySecret
} from "@/lib/control-plane-security";
import { getEmailProvider } from "@/lib/email-provider";
import type { InternalAdminActor } from "@/lib/admin-auth";

const CURRENT_EULA = {
  eulaVersion: process.env.EULA_VERSION || "2026-07",
  documentSha256:
    process.env.EULA_DOCUMENT_SHA256 ||
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  privacyVersion: process.env.PRIVACY_VERSION || "2026-07",
  systemAcknowledgementVersion: process.env.SYSTEM_ACK_VERSION || "setup-v1"
};

export function jsonError(error: unknown, correlationId = publicId("corr")) {
  if (error instanceof ControlPlaneError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          correlationId,
          retryable: error.retryable
        }
      },
      { status: error.status }
    );
  }
  console.error("[control-plane]", correlationId, error);
  return NextResponse.json(
    {
      error: {
        code: "ACTIVATION_UNAVAILABLE",
        message: "Control plane temporarily unavailable",
        correlationId,
        retryable: true
      }
    },
    { status: 503 }
  );
}

export async function writeAudit(input: {
  organizationId?: string;
  storeId?: string;
  workerInstallationId?: string;
  actorType: "internal_admin" | "app_user" | "worker" | "system";
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}) {
  await AuditEventModel.create({
    auditEventId: publicId("aud"),
    organizationId: input.organizationId || "org_system",
    storeId: input.storeId,
    workerInstallationId: input.workerInstallationId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    correlationId: input.correlationId || publicId("corr"),
    metadata: safeJson(input.metadata || {}),
    occurredAt: new Date()
  });
}


export const DEFAULT_ORG_ROLES = [
  {
    roleName: "Organization Admin",
    roleId: "org_admin",
    accessKeys: {
      electron: {
        pages: [
          { key: "pos",            enabled: true, featureFlags: { enableRefunds: true, enableDiscounts: true, enableVoidTransaction: true, enableCashDrawer: true } },
          { key: "dashboard",      enabled: true, featureFlags: {} },
          { key: "products",       enabled: true, featureFlags: { enableBulkImport: true, enableBarcodeGeneration: true } },
          { key: "vendors",        enabled: true, featureFlags: {} },
          { key: "vendorPrices",   enabled: true, featureFlags: {} },
          { key: "priceBook",      enabled: true, featureFlags: {} },
          { key: "costAnalysis",   enabled: true, featureFlags: {} },
          { key: "transactions",   enabled: true, featureFlags: { enableExport: true, enableRefundView: true } },
          { key: "manageWorker",   enabled: true, featureFlags: {} },
          { key: "userManagement", enabled: true, featureFlags: {} },
          { key: "settings",       enabled: true, featureFlags: {} }
        ]
      },
      mobile: {
        pages: [
          { key: "mobilePos",           enabled: true, featureFlags: { enableManualEntry: true, enableQuickSale: true } },
          { key: "mobileDashboard",      enabled: true, featureFlags: {} },
          { key: "mobileScanner",        enabled: true, featureFlags: { enableCameraFlash: true, enableManualEntry: true } },
          { key: "mobileProductSearch",  enabled: true, featureFlags: {} },
          { key: "mobileVendorPrices",   enabled: true, featureFlags: {} },
          { key: "mobilePriceBook",      enabled: true, featureFlags: {} },
          { key: "mobileTransactions",   enabled: true, featureFlags: { enableExport: true } },
          { key: "mobileReports",        enabled: true, featureFlags: {} },
          { key: "mobileAnalytics",      enabled: true, featureFlags: {} },
          { key: "mobileSalesTax",       enabled: true, featureFlags: {} }
        ]
      }
    }
  }
];

export async function createOrganization(
  admin: InternalAdminActor,
  body: { name: string; slug?: string; billingEmail?: string }
) {
  await connectDb();
  const organizationId = publicId("org");
  const slug =
    body.slug?.trim().toLowerCase() ||
    body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    organizationId;
  const doc = await OrganizationModel.create({
    organizationId,
    name: body.name.trim(),
    slug,
    billingEmail: body.billingEmail?.trim().toLowerCase(),
    status: "active",
    roles: DEFAULT_ORG_ROLES
  });
  await writeAudit({
    organizationId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "organization.create",
    targetType: "organization",
    targetId: organizationId
  });
  return safeJson(doc.toObject());
}

export async function createSubscription(
  admin: InternalAdminActor,
  organizationId: string,
  body: {
    plan: "trial" | "standard" | "custom";
    maxStores?: number;
    maxWorkerInstallations?: number;
    entitlementDays?: number;
  }
) {
  await connectDb();
  const org = await OrganizationModel.findOne({ organizationId, status: "active" }).lean();
  if (!org) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Organization not found");
  const days = body.entitlementDays ?? (body.plan === "trial" ? 30 : 365);
  const startsAt = new Date();
  const ends = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  const subscriptionId = publicId("sub");
  const doc = await SubscriptionModel.create({
    organizationId,
    subscriptionId,
    plan: body.plan,
    status: body.plan === "trial" ? "trialing" : "active",
    startsAt,
    supportEndsAt: ends,
    entitlementExpiresAt: ends,
    maxStores: body.maxStores ?? 5,
    maxWorkerInstallations: body.maxWorkerInstallations ?? 5
  });
  await writeAudit({
    organizationId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "subscription.create",
    targetType: "subscription",
    targetId: subscriptionId
  });
  return safeJson(doc.toObject());
}

export async function createStore(
  admin: InternalAdminActor,
  organizationId: string,
  body: {
    subscriptionId: string;
    name: string;
    storeNumber?: string;
    address?: string;
    contactEmail?: string;
    slug?: string;
  }
) {
  await connectDb();
  const org = await OrganizationModel.findOne({ organizationId }).lean();
  const sub = await SubscriptionModel.findOne({
    organizationId,
    subscriptionId: body.subscriptionId,
    status: { $in: ["trialing", "active"] }
  }).lean();
  if (!org || !sub) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Resource not found");
  const storeCount = await TenantStoreModel.countDocuments({ organizationId });
  if (storeCount >= Number(sub.maxStores)) {
    throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "Store entitlement exhausted");
  }
  const storeId = publicId("store");

  let cloudflareToken: string | undefined;
  let tunnelUrl: string | undefined;

  try {
    const cf = await provisionCloudflareTunnel(storeId, body.slug || storeId);
    if (cf) {
      cloudflareToken = cf.cloudflareToken;
      tunnelUrl = cf.tunnelUrl;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cloudflare-provision] Failed to provision tunnel: ${msg}`);
  }

  const doc = await TenantStoreModel.create({
    organizationId,
    storeId,
    subscriptionId: body.subscriptionId,
    name: body.name.trim(),
    storeNumber: body.storeNumber?.trim(),
    address: body.address?.trim(),
    contactEmail: body.contactEmail?.trim().toLowerCase(),
    cloudflareToken,
    tunnelUrl,
    configJson: JSON.stringify({
      posIntegration: "verifone_commander",
      posIpAddress: "",
      posUsername: "",
      posPassword: "",
      featureFlags: {
        enableBetaScanner: false
      }
    }, null, 2),
    status: "active"
  });
  await writeAudit({
    organizationId,
    storeId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "store.create",
    targetType: "store",
    targetId: storeId
  });
  return safeJson(doc.toObject());
}

export async function createWorkerInstallation(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  body: {
    subscriptionId?: string;
    workerName: string;
    contactEmail: string;
    storeNumber?: string;
    address?: string;
  }
) {
  await connectDb();
  const store = await TenantStoreModel.findOne({ organizationId, storeId, status: "active" }).lean();
  if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");
  const subscriptionId = body.subscriptionId || String(store.subscriptionId);
  const sub = await SubscriptionModel.findOne({
    organizationId,
    subscriptionId,
    status: { $in: ["trialing", "active"] },
    entitlementExpiresAt: { $gt: new Date() }
  }).lean();
  if (!sub) throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "No eligible subscription");
  const installCount = await WorkerInstallationModel.countDocuments({ organizationId, storeId });
  if (installCount >= Number(sub.maxWorkerInstallations)) {
    throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "Worker entitlement exhausted");
  }
  const workerInstallationId = publicId("winst");
  const doc = await WorkerInstallationModel.create({
    organizationId,
    storeId,
    subscriptionId,
    workerInstallationId,
    workerName: body.workerName.trim(),
    contactEmail: body.contactEmail.trim().toLowerCase(),
    storeNumberSnapshot: body.storeNumber?.trim() || store.storeNumber,
    addressSnapshot: body.address?.trim() || store.address,
    status: "awaiting_activation"
  });
  await writeAudit({
    organizationId,
    storeId,
    workerInstallationId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "worker_installation.create",
    targetType: "worker_installation",
    targetId: workerInstallationId
  });
  return safeJson(doc.toObject());
}

export async function issueSetupKeyEmail(
  admin: InternalAdminActor,
  organizationId: string,
  storeId: string,
  workerInstallationId: string,
  body: { deliveryReason: string; idempotencyKey: string }
) {
  await connectDb();
  const installation = await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    workerInstallationId
  }).lean();
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found");

  const existing = await SetupKeyModel.findOne({
    workerInstallationId,
    idempotencyKey: body.idempotencyKey
  }).lean();
  if (existing) {
    return safeJson({
      keyId: existing.keyId,
      status: existing.status,
      expiresAt: existing.expiresAt,
      contactEmail: existing.contactEmail,
      deliveryProvider: existing.deliveryProvider,
      deliveryMessageId: existing.deliveryMessageId
    });
  }

  await SetupKeyModel.updateMany(
    {
      workerInstallationId,
      status: { $in: ["queued", "sent", "delivery_failed"] }
    },
    { status: "revoked", revokedAt: new Date() }
  );

  const issued = issueSetupKey();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const record = await SetupKeyModel.create({
    organizationId,
    storeId,
    workerInstallationId,
    subscriptionId: installation.subscriptionId,
    keyId: issued.keyId,
    secretHash: await hashSecret(issued.secret),
    contactEmail: installation.contactEmail,
    status: "queued",
    expiresAt,
    deliveryReason: body.deliveryReason,
    idempotencyKey: body.idempotencyKey,
    createdByAdminId: admin.adminId
  });

  const org = await OrganizationModel.findOne({ organizationId }).lean();
  const store = await TenantStoreModel.findOne({ storeId }).lean();
  try {
    const delivery = await getEmailProvider().sendSetupKey({
      to: String(installation.contactEmail),
      recipientName: String(installation.workerName),
      organizationName: String(org?.name || organizationId),
      storeName: String(store?.name || storeId),
      setupKey: issued.plaintext,
      expiresAt
    });
    record.status = "sent";
    record.deliveryProvider = delivery.provider;
    record.deliveryMessageId = delivery.messageId;
    await record.save();
  } catch (error) {
    record.status = "delivery_failed";
    await record.save();
    await writeAudit({
      organizationId,
      storeId,
      workerInstallationId,
      actorType: "internal_admin",
      actorId: admin.adminId,
      action: "setup_key.delivery_failed",
      targetType: "setup_key",
      targetId: issued.keyId,
      reason: error instanceof Error ? error.message : "delivery failed"
    });
  }

  await writeAudit({
    organizationId,
    storeId,
    workerInstallationId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "setup_key.issue",
    targetType: "setup_key",
    targetId: issued.keyId,
    metadata: { status: record.status }
  });

  return safeJson({
    keyId: record.keyId,
    setupKey: issued.plaintext,
    status: record.status,
    expiresAt: record.expiresAt,
    contactEmail: record.contactEmail,
    deliveryProvider: record.deliveryProvider,
    deliveryMessageId: record.deliveryMessageId
  });
}

export async function redeemSetupKey(body: {
  setupKey: string;
  acknowledgements: {
    eulaVersion: string;
    eulaDocumentSha256: string;
    privacyVersion: string;
    systemAcknowledgementVersion: string;
    acceptedAt: string;
    osAcknowledged?: boolean;
    privacyAcknowledged?: boolean;
    localDataAcknowledged?: boolean;
  };
  installation: {
    platform: "windows" | "macos" | "linux";
    workerVersion: string;
    electronVersion: string;
    type?: string;
  };
}) {
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
    throw new ControlPlaneError(401, "SETUP_KEY_INVALID", "Setup key is invalid");
  }
  if (key.status === "consumed") {
    throw new ControlPlaneError(409, "SETUP_KEY_CONSUMED", "Setup key has been consumed");
  }
  if (
    key.status === "revoked" ||
    key.status === "expired" ||
    new Date(key.expiresAt).getTime() <= Date.now()
  ) {
    throw new ControlPlaneError(410, "SETUP_KEY_EXPIRED", "Setup key has expired");
  }

  const ack = body.acknowledgements;

  const sub = await SubscriptionModel.findOne({
    organizationId: key.organizationId,
    subscriptionId: key.subscriptionId,
    status: { $in: ["trialing", "active"] },
    entitlementExpiresAt: { $gt: new Date() }
  }).lean();
  if (!sub) throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "Subscription inactive");

  const store = await TenantStoreModel.findOne({
    organizationId: key.organizationId,
    storeId: key.storeId
  }).lean();

  const installation = await WorkerInstallationModel.findOne({
    workerInstallationId: key.workerInstallationId,
    organizationId: key.organizationId,
    storeId: key.storeId
  });
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Installation not found");
  if (installation.status === "suspended") {
    throw new ControlPlaneError(423, "STORE_SUSPENDED", "Store cannot activate");
  }
  if (installation.workerCredentialId && installation.status === "active") {
    throw new ControlPlaneError(409, "INSTALLATION_ALREADY_BOUND", "Installation already bound");
  }

  const consume = await SetupKeyModel.findOneAndUpdate(
    { keyId: key.keyId, status: { $in: ["queued", "sent", "delivery_failed"] } },
    { status: "consumed", consumedAt: new Date(), $inc: { attempts: 1 } },
    { new: true }
  );
  if (!consume) {
    throw new ControlPlaneError(409, "SETUP_KEY_CONSUMED", "Setup key has been consumed");
  }

  const eulaAcceptanceId = publicId("eula");
  await EulaAcceptanceModel.create({
    eulaAcceptanceId,
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    contactEmail: key.contactEmail,
    eulaVersion: ack.eulaVersion,
    documentSha256: ack.eulaDocumentSha256,
    privacyVersion: ack.privacyVersion,
    systemAcknowledgementVersion: ack.systemAcknowledgementVersion,
    osAcknowledged: Boolean(ack.osAcknowledged),
    privacyAcknowledged: Boolean(ack.privacyAcknowledged),
    localDataAcknowledged: Boolean(ack.localDataAcknowledged),
    acceptedAt: new Date(ack.acceptedAt),
    redeemedAt: new Date(),
    correlationId,
    source: "setup_key_redeem"
  });

  const workerCredentialId = publicId("wkrc");
  const credentialSecret = randomSecret(32);
  const secretHash = await hashSecret(credentialSecret);

  installation.workerCredentialId = workerCredentialId;
  installation.status = "active";
  installation.firstBootstrapCompletedAt = new Date();
  installation.platform = body.installation.platform;
  installation.workerVersion = body.installation.workerVersion;
  installation.electronVersion = body.installation.electronVersion;
  await installation.save();

  await WorkerCredentialModel.create({
    workerCredentialId,
    secretHash,
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    status: "active",
    issuedAt: new Date()
  });

  await AuditEventModel.create({
    eventId: publicId("aud"),
    organizationId: key.organizationId,
    storeId: key.storeId,
    actorType: "system",
    actorId: "setup_flow",
    action: "setup_key.redeem",
    targetType: "WorkerInstallation",
    targetId: key.workerInstallationId,
    correlationId,
    details: {
      setupKeyId: key.keyId,
      workerCredentialId,
      contactEmail: key.contactEmail
    }
  });

  return {
    contractVersion: CONTRACT_VERSION,
    workerCredential: `${workerCredentialId}.${credentialSecret}`,
    workerCredentialId,
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    cloudflareToken: (installation as Record<string, unknown>).cloudflareToken,
    store: {
      organizationId: key.organizationId,
      storeId: key.storeId,
      workerInstallationId: key.workerInstallationId
    }
  };
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
  const sub = await SubscriptionModel.findOne({
    organizationId,
    subscriptionId: installation.subscriptionId
  }).lean();
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
          offlineGraceDays: sub.offlineGraceDays
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

export async function provisionAppUser(
  admin: InternalAdminActor,
  body: { email: string; name?: string }
) {
  await connectDb();
  const email = body.email.trim().toLowerCase();
  const existing = await AppUserModel.findOne({ email }).lean();
  if (existing) throw new ControlPlaneError(409, "RESOURCE_EXISTS", "App user already exists");
  const enrollmentSecret = randomSecret(24);
  const appUserId = publicId("appu");
  const doc = await AppUserModel.create({
    appUserId,
    email,
    name: body.name?.trim(),
    status: "pending_enrollment",
    enrollmentSecretHash: await hashSecret(enrollmentSecret),
    enrollmentExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    createdByAdminId: admin.adminId
  });
  await writeAudit({
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "app_user.create",
    targetType: "app_user",
    targetId: appUserId
  });
  // Enrollment secret returned once to admin for out-of-band delivery (email provider optional).
  return {
    ...safeJson(doc.toObject()),
    enrollmentCredential: `${appUserId}.${enrollmentSecret}`
  };
}

export async function createAssignment(
  admin: InternalAdminActor,
  appUserId: string,
  body: {
    organizationId: string;
    storeId: string;
    workerInstallationId: string;
    role: string;
    scopes?: string[];
  }
) {
  await connectDb();
  const user = await AppUserModel.findOne({ appUserId }).lean();
  const installation = await WorkerInstallationModel.findOne({
    organizationId: body.organizationId,
    storeId: body.storeId,
    workerInstallationId: body.workerInstallationId
  }).lean();
  if (!user || !installation) {
    throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
  const assignmentId = publicId("assign");
  const doc = await UserAssignmentModel.create({
    assignmentId,
    appUserId,
    organizationId: body.organizationId,
    storeId: body.storeId,
    workerInstallationId: body.workerInstallationId,
    role: body.role,
    scopes: body.scopes || ["relay:request"],
    status: "active",
    createdByAdminId: admin.adminId
  });
  await writeAudit({
    organizationId: body.organizationId,
    storeId: body.storeId,
    workerInstallationId: body.workerInstallationId,
    actorType: "internal_admin",
    actorId: admin.adminId,
    action: "assignment.create",
    targetType: "user_assignment",
    targetId: assignmentId
  });
  return safeJson(doc.toObject());
}

async function assignmentSummaries(appUserId: string) {
  const assignments = await UserAssignmentModel.find({ appUserId, status: "active" }).lean();
  const summaries = [];
  for (const a of assignments) {
    const [org, store, installation] = await Promise.all([
      OrganizationModel.findOne({ organizationId: a.organizationId }).lean(),
      TenantStoreModel.findOne({ storeId: a.storeId }).lean(),
      WorkerInstallationModel.findOne({ workerInstallationId: a.workerInstallationId }).lean()
    ]);
    // Parse pageAccess and roleAccess: Organization.roles first, fallback to store.configJson, then DEFAULT_ORG_ROLES
    let pageAccess: Record<string, { enabled: boolean }> = {};
    let roleAccess: Record<string, unknown> | null = null;
    const orgRoles = Array.isArray((org as Record<string, unknown> | null)?.roles)
      ? ((org as Record<string, unknown>).roles as Record<string, unknown>[])
      : [];
    if (orgRoles.length > 0) {
      roleAccess = orgRoles.find(r => r.roleId === a.role) || null;
    }
    try {
      const raw = (store as Record<string, unknown> | null)?.configJson;
      if (raw && typeof raw === "string") {
        const parsed = JSON.parse(raw);
        pageAccess = parsed.pageAccess || {};
        if (!roleAccess && Array.isArray(parsed.roles)) {
          roleAccess = parsed.roles.find((r: Record<string, unknown>) => r.roleId === a.role) || null;
        }
      }
    } catch { }
    if (!roleAccess) {
      roleAccess = DEFAULT_ORG_ROLES.find(r => r.roleId === a.role) || DEFAULT_ORG_ROLES[0];
    }
    summaries.push({
      assignmentId: a.assignmentId,
      organizationId: a.organizationId,
      organizationName: org?.name,
      storeId: a.storeId,
      storeName: store?.name,
      workerInstallationId: a.workerInstallationId,
      workerName: installation?.workerName,
      role: a.role,
      scopes: a.scopes,
      pageAccess,
      roleAccess,
      ready: Boolean(
        installation?.status === "active" && installation.firstBootstrapCompletedAt
      ),
      tunnelUrl: (store as Record<string, unknown> | null)?.tunnelUrl ? String((store as Record<string, unknown>).tunnelUrl) : null,
      lanUrl: (installation as Record<string, unknown> | null)?.lanUrl ? String((installation as Record<string, unknown>).lanUrl) : null
    });
  }
  return summaries;
}

export async function enrollAppUser(body: {
  enrollmentCredential: string;
  password: string;
  deviceName: string;
  audience: "desktop" | "mobile";
}) {
  await connectDb();
  const [appUserId, secret, extra] = body.enrollmentCredential.split(".");
  if (!appUserId?.startsWith("appu_") || !secret || extra) {
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
  if (user.enrollmentExpiresAt && user.enrollmentExpiresAt.getTime() <= Date.now()) {
    throw new ControlPlaneError(410, "ENROLLMENT_EXPIRED", "Enrollment expired");
  }
  user.passwordHash = await hashSecret(body.password);
  user.status = "active";
  user.enrollmentConsumedAt = new Date();
  user.enrollmentSecretHash = undefined;
  await user.save();

  const deviceId = publicId("dev");
  await ClientDeviceModel.create({
    deviceId,
    appUserId,
    audience: body.audience,
    deviceName: body.deviceName.trim(),
    status: "active",
    lastSeenAt: new Date()
  });

  const assignments = await assignmentSummaries(appUserId);
  return {
    contractVersion: CONTRACT_VERSION,
    appUserId,
    deviceId,
    assignments
  };
}

export async function loginAppUser(body: {
  email: string;
  password: string;
  deviceName?: string;
  audience: "desktop" | "mobile";
  deviceId?: string;
}) {
  await connectDb();
  const user = await AppUserModel.findOne({
    email: body.email.trim().toLowerCase()
  }).select("+passwordHash");
  if (!user || !user.passwordHash || !(await verifySecret(String(user.passwordHash), body.password))) {
    throw new ControlPlaneError(401, "LOGIN_INVALID", "Email or password is invalid");
  }
  if (user.status !== "active") {
    throw new ControlPlaneError(403, "AUTHORIZATION_DENIED", "App user is not active");
  }
  user.lastLoginAt = new Date();
  await user.save();

  let deviceId = body.deviceId;
  if (deviceId) {
    const device = await ClientDeviceModel.findOne({
      deviceId,
      appUserId: user.appUserId,
      status: "active"
    }).lean();
    if (!device) throw new ControlPlaneError(403, "DEVICE_REVOKED", "Device is not active");
  } else {
    deviceId = publicId("dev");
    await ClientDeviceModel.create({
      deviceId,
      appUserId: user.appUserId,
      audience: body.audience,
      deviceName: body.deviceName?.trim() || `${body.audience}-device`,
      status: "active",
      lastSeenAt: new Date()
    });
  }

  const assignments = await assignmentSummaries(String(user.appUserId));
  return {
    contractVersion: CONTRACT_VERSION,
    appUserId: user.appUserId,
    deviceId,
    assignments
  };
}

export async function issueClientSession(body: {
  appUserId: string;
  deviceId: string;
  assignmentId: string;
  audience: "desktop" | "mobile";
}) {
  await connectDb();
  const assignment = await UserAssignmentModel.findOne({
    assignmentId: body.assignmentId,
    appUserId: body.appUserId,
    status: "active"
  }).lean();
  if (!assignment) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Assignment not found");

  const installation = await WorkerInstallationModel.findOne({
    workerInstallationId: assignment.workerInstallationId,
    organizationId: assignment.organizationId,
    storeId: assignment.storeId
  }).lean();
  if (!installation?.firstBootstrapCompletedAt || installation.status !== "active") {
    throw new ControlPlaneError(
      409,
      "WORKER_BOOTSTRAP_INCOMPLETE",
      "Assigned Worker is not ready"
    );
  }

  const sub = await SubscriptionModel.findOne({
    organizationId: assignment.organizationId,
    subscriptionId: installation.subscriptionId,
    status: { $in: ["trialing", "active"] },
    entitlementExpiresAt: { $gt: new Date() }
  }).lean();
  if (!sub) throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "Subscription inactive");

  const device = await ClientDeviceModel.findOne({
    deviceId: body.deviceId,
    appUserId: body.appUserId,
    status: "active"
  }).lean();
  if (!device) throw new ControlPlaneError(403, "DEVICE_REVOKED", "Device is not active");

  const refreshId = publicId("ref");
  const refreshSecret = randomSecret(32);
  await ClientRefreshCredentialModel.create({
    refreshId,
    secretHash: await hashSecret(refreshSecret),
    appUserId: body.appUserId,
    assignmentId: body.assignmentId,
    deviceId: body.deviceId,
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  const relay = signRelaySession({
    sub: body.appUserId,
    storeId: String(assignment.storeId),
    installationId: String(assignment.workerInstallationId),
    role: "client",
    scopes: (assignment.scopes as string[]) || ["relay:request"],
    organizationId: String(assignment.organizationId),
    assignmentId: String(assignment.assignmentId),
    audience: body.audience
  });

  const clientSessionId = publicId("cses");
  await ClientSessionModel.create({
    clientSessionId,
    appUserId: body.appUserId,
    assignmentId: body.assignmentId,
    deviceId: body.deviceId,
    organizationId: assignment.organizationId,
    storeId: assignment.storeId,
    workerInstallationId: assignment.workerInstallationId,
    audience: body.audience,
    scopes: assignment.scopes,
    status: "active",
    expiresAt: relay.expiresAt
  });

  const [store, org] = await Promise.all([
    TenantStoreModel.findOne({ storeId: assignment.storeId }).lean(),
    OrganizationModel.findOne({ organizationId: assignment.organizationId }).lean()
  ]);

  // Parse pageAccess and roleAccess from Organization.roles or store's configJson
  let pageAccess: Record<string, { enabled: boolean }> = {};
  let roleAccess: Record<string, unknown> | null = null;

  const orgRoles = Array.isArray((org as Record<string, unknown> | null)?.roles)
    ? ((org as Record<string, unknown>).roles as Record<string, unknown>[])
    : [];
  if (orgRoles.length > 0) {
    roleAccess = orgRoles.find(r => r.roleId === assignment.role) || null;
  }

  try {
    const raw = (store as Record<string, unknown> | null)?.configJson;
    if (raw && typeof raw === "string") {
      const parsed = JSON.parse(raw);
      pageAccess = parsed.pageAccess || {};
      if (!roleAccess && Array.isArray(parsed.roles)) {
        roleAccess = parsed.roles.find((r: Record<string, unknown>) => r.roleId === assignment.role) || null;
      }
    }
  } catch { }

  if (!roleAccess) {
    roleAccess = DEFAULT_ORG_ROLES.find(r => r.roleId === assignment.role) || DEFAULT_ORG_ROLES[0];
  }

  return {
    contractVersion: CONTRACT_VERSION,
    sessionToken: relay.token,
    expiresAt: relay.expiresAt.toISOString(),
    organizationId: assignment.organizationId,
    storeId: assignment.storeId,
    workerInstallationId: assignment.workerInstallationId,
    assignmentId: assignment.assignmentId,
    role: assignment.role,
    scopes: assignment.scopes,
    pageAccess,
    roleAccess,
    refreshCredential: `${refreshId}.${refreshSecret}`,
    tunnelUrl: (store as Record<string, unknown>)?.tunnelUrl as string | null,
    lanUrl: (installation as Record<string, unknown>)?.lanUrl as string | null
  };
}
