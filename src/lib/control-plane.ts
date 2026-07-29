import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
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

function hubUrl() {
  return process.env.HUB_WSS_URL?.trim() || "wss://hub.example.invalid/ws";
}

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
    status: "active"
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
  const doc = await TenantStoreModel.create({
    organizationId,
    storeId,
    subscriptionId: body.subscriptionId,
    name: body.name.trim(),
    storeNumber: body.storeNumber?.trim(),
    address: body.address?.trim(),
    contactEmail: body.contactEmail?.trim().toLowerCase(),
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
    contactEmail: string;
    acceptedAt: string;
    osAcknowledged?: boolean;
    privacyAcknowledged?: boolean;
    localDataAcknowledged?: boolean;
  };
  installation: {
    organizationId: string;
    storeId: string;
    workerInstallationId: string;
    platform: "windows" | "macos" | "linux";
    workerVersion: string;
    serviceManagerVersion: string;
  };
}) {
  await connectDb();
  const correlationId = publicId("corr");
  enforceRateLimit(`redeem:${body.installation.workerInstallationId}`, {
    limit: 20,
    windowMs: 60_000
  });

  const parsed = parseSetupKey(body.setupKey);
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
  if (
    key.organizationId !== body.installation.organizationId ||
    key.storeId !== body.installation.storeId ||
    key.workerInstallationId !== body.installation.workerInstallationId ||
    String(key.contactEmail).toLowerCase() !== body.acknowledgements.contactEmail.trim().toLowerCase()
  ) {
    throw new ControlPlaneError(401, "SETUP_KEY_INVALID", "Setup key is invalid");
  }

  const ack = body.acknowledgements;
  if (
    ack.eulaVersion !== CURRENT_EULA.eulaVersion ||
    ack.eulaDocumentSha256 !== CURRENT_EULA.documentSha256 ||
    ack.privacyVersion !== CURRENT_EULA.privacyVersion ||
    ack.systemAcknowledgementVersion !== CURRENT_EULA.systemAcknowledgementVersion ||
    ack.osAcknowledged === false ||
    ack.privacyAcknowledged === false ||
    ack.localDataAcknowledged === false
  ) {
    throw new ControlPlaneError(428, "EULA_ACCEPTANCE_REQUIRED", "Current EULA acceptance required");
  }

  const sub = await SubscriptionModel.findOne({
    organizationId: key.organizationId,
    subscriptionId: key.subscriptionId,
    status: { $in: ["trialing", "active"] },
    entitlementExpiresAt: { $gt: new Date() }
  }).lean();
  if (!sub) throw new ControlPlaneError(402, "SUBSCRIPTION_INACTIVE", "Subscription inactive");

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
    osAcknowledged: ack.osAcknowledged !== false,
    privacyAcknowledged: ack.privacyAcknowledged !== false,
    localDataAcknowledged: ack.localDataAcknowledged !== false,
    acceptedAt: new Date(ack.acceptedAt),
    redeemedAt: new Date(),
    correlationId,
    source: "setup_key_redeem"
  });

  const credentialId = publicId("wcred");
  const secret = randomSecret(32);
  await WorkerCredentialModel.create({
    credentialId,
    organizationId: key.organizationId,
    storeId: key.storeId,
    workerInstallationId: key.workerInstallationId,
    secretHash: await hashSecret(secret),
    keyId: key.keyId,
    status: "active",
    issuedAt: new Date()
  });

  installation.status = "active";
  installation.platform = body.installation.platform;
  installation.workerVersion = body.installation.workerVersion;
  installation.serviceManagerVersion = body.installation.serviceManagerVersion;
  installation.workerCredentialId = credentialId;
  installation.eulaAcceptanceId = eulaAcceptanceId;
  installation.activatedAt = new Date();
  await installation.save();

  await writeAudit({
    organizationId: String(key.organizationId),
    storeId: String(key.storeId),
    workerInstallationId: String(key.workerInstallationId),
    actorType: "worker",
    actorId: credentialId,
    action: "setup_key.redeem",
    targetType: "worker_credential",
    targetId: credentialId,
    correlationId
  });

  const offlineGraceUntil = new Date(
    new Date(sub.entitlementExpiresAt).getTime() + Number(sub.offlineGraceDays || 0) * 86400000
  );

  return {
    contractVersion: CONTRACT_VERSION,
    store: {
      storeId: key.storeId,
      organizationId: key.organizationId,
      workerInstallationId: key.workerInstallationId,
      status: "active"
    },
    subscription: {
      status: sub.status,
      entitlementExpiresAt: sub.entitlementExpiresAt,
      offlineGraceUntil
    },
    workerCredential: `${credentialId}.${secret}`,
    workerCredentialId: credentialId,
    hubUrl: hubUrl(),
    issuedAt: new Date().toISOString()
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
    hubUrl: hubUrl(),
    protocolRange: { min: 1, max: 1 },
    serverTime: new Date().toISOString(),
    firstBootstrapCompletedAt: installation.firstBootstrapCompletedAt || null
  });
}

export async function completeBootstrap(
  organizationId: string,
  storeId: string,
  workerInstallationId: string,
  body: { bootstrapVersion: string; hubHandshakeOk: boolean }
) {
  await connectDb();
  const installation = await WorkerInstallationModel.findOne({
    organizationId,
    storeId,
    workerInstallationId
  });
  if (!installation) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Not found");
  if (!installation.firstBootstrapCompletedAt) {
    installation.firstBootstrapCompletedAt = new Date();
    installation.bootstrapVersion = body.bootstrapVersion;
    if (body.hubHandshakeOk) installation.hubVerifiedAt = new Date();
    await installation.save();
  }
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
    role: "store_operator" | "store_manager" | "viewer";
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
      ready: Boolean(
        installation?.status === "active" && installation.firstBootstrapCompletedAt
      )
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

  return {
    contractVersion: CONTRACT_VERSION,
    sessionToken: relay.token,
    expiresAt: relay.expiresAt.toISOString(),
    hubUrl: hubUrl(),
    organizationId: assignment.organizationId,
    storeId: assignment.storeId,
    workerInstallationId: assignment.workerInstallationId,
    assignmentId: assignment.assignmentId,
    role: "app_user",
    scopes: assignment.scopes,
    refreshCredential: `${refreshId}.${refreshSecret}`
  };
}
