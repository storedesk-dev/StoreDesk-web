import { Schema, model, models } from "mongoose";

const id = { type: String, required: true, index: true } as const;
const tenant = { organizationId: id };
const timestamps = { timestamps: true, versionKey: false } as const;

/** Web-only operator identity. Never an Organization customer login. */
const InternalAdminSchema = new Schema(
  {
    adminId: { ...id, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastLoginAt: Date
  },
  timestamps
);

const AdminSessionSchema = new Schema(
  {
    sessionId: { ...id, unique: true },
    adminId: id,
    secretHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: Date,
    lastSeenAt: Date
  },
  timestamps
);

const OrganizationSchema = new Schema(
  {
    organizationId: { ...id, unique: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    billingEmail: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "active" }
  },
  timestamps
);

const SubscriptionSchema = new Schema(
  {
    ...tenant,
    subscriptionId: { ...id, unique: true },
    plan: { type: String, enum: ["trial", "standard", "custom"], required: true },
    status: {
      type: String,
      enum: ["trialing", "active", "suspended", "cancelled", "expired"],
      required: true
    },
    startsAt: { type: Date, required: true },
    supportEndsAt: { type: Date, required: true },
    entitlementExpiresAt: { type: Date, required: true },
    offlineGraceDays: { type: Number, min: 0, max: 90, default: 7 },
    maxStores: { type: Number, min: 1, required: true },
    maxWorkerInstallations: { type: Number, min: 1, required: true },
    maxDevices: { type: Number, min: 0, default: 5 },
    features: { type: [String], default: ["desktop", "mobile", "edge"] }
  },
  timestamps
);

const TenantStoreSchema = new Schema(
  {
    ...tenant,
    storeId: { ...id, unique: true },
    subscriptionId: id,
    name: { type: String, required: true, trim: true },
    storeNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "active", "suspended", "closed"], default: "active" },
    tunnelUrl: { type: String, trim: true },
    cloudflareToken: { type: String, trim: true }
  },
  timestamps
);

const WorkerInstallationSchema = new Schema(
  {
    ...tenant,
    workerInstallationId: { ...id, unique: true },
    storeId: id,
    subscriptionId: id,
    workerName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    storeNumberSnapshot: String,
    addressSnapshot: String,
    status: {
      type: String,
      enum: [
        "not_installed",
        "installed",
        "awaiting_activation",
        "active",
        "degraded",
        "suspended",
        "updating",
        "rollback"
      ],
      default: "awaiting_activation"
    },
    platform: { type: String, enum: ["windows", "macos", "linux"] },
    workerVersion: String,
    serviceManagerVersion: String,
    workerCredentialId: String,
    eulaAcceptanceId: String,
    activatedAt: Date,
    firstBootstrapCompletedAt: Date,
    bootstrapVersion: String,
    hubVerifiedAt: Date,
    lastSeenAt: Date,
    lanUrl: { type: String, trim: true }
  },
  timestamps
);
WorkerInstallationSchema.index({ organizationId: 1, storeId: 1 });

const SetupKeySchema = new Schema(
  {
    ...tenant,
    keyId: { ...id, unique: true },
    secretHash: { type: String, required: true, select: false },
    storeId: id,
    workerInstallationId: id,
    subscriptionId: id,
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["queued", "sent", "delivery_failed", "consumed", "expired", "revoked"],
      default: "queued"
    },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: Date,
    revokedAt: Date,
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 8 },
    deliveryProvider: String,
    deliveryMessageId: String,
    deliveryReason: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    createdByAdminId: id
  },
  timestamps
);
SetupKeySchema.index({ workerInstallationId: 1, idempotencyKey: 1 }, { unique: true });

const EulaAcceptanceSchema = new Schema(
  {
    ...tenant,
    eulaAcceptanceId: { ...id, unique: true },
    storeId: id,
    workerInstallationId: id,
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    eulaVersion: { type: String, required: true },
    documentSha256: { type: String, required: true },
    privacyVersion: { type: String, required: true },
    systemAcknowledgementVersion: { type: String, required: true },
    osAcknowledged: { type: Boolean, required: true },
    privacyAcknowledged: { type: Boolean, required: true },
    localDataAcknowledged: { type: Boolean, required: true },
    acceptedAt: { type: Date, required: true },
    redeemedAt: { type: Date, required: true },
    correlationId: id,
    source: { type: String, required: true },
    userAgent: String,
    ipHash: String
  },
  { ...timestamps, strict: "throw" }
);

const WorkerCredentialSchema = new Schema(
  {
    ...tenant,
    credentialId: { ...id, unique: true },
    secretHash: { type: String, required: true, select: false },
    keyId: { type: String, required: true },
    storeId: id,
    workerInstallationId: id,
    status: { type: String, enum: ["active", "overlap", "revoked"], default: "active" },
    issuedAt: { type: Date, required: true },
    expiresAt: Date,
    overlapEndsAt: Date,
    revokedAt: Date
  },
  timestamps
);
WorkerCredentialSchema.index(
  { workerInstallationId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

const RotationChallengeSchema = new Schema(
  {
    ...tenant,
    challengeId: { ...id, unique: true },
    challengeHash: { type: String, required: true, select: false },
    storeId: id,
    workerInstallationId: id,
    currentCredentialId: id,
    status: { type: String, enum: ["pending", "consumed", "expired", "revoked"], default: "pending" },
    reason: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdByAdminId: id,
    consumedAt: Date
  },
  timestamps
);

/** Electron/Mobile product identity — cannot access Web admin. */
const AppUserSchema = new Schema(
  {
    appUserId: { ...id, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    status: { type: String, enum: ["pending_enrollment", "active", "disabled"], default: "pending_enrollment" },
    enrollmentSecretHash: { type: String, select: false },
    enrollmentExpiresAt: Date,
    enrollmentConsumedAt: Date,
    lastLoginAt: Date,
    createdByAdminId: id
  },
  timestamps
);

const UserAssignmentSchema = new Schema(
  {
    assignmentId: { ...id, unique: true },
    appUserId: id,
    organizationId: id,
    storeId: id,
    workerInstallationId: id,
    role: { type: String, enum: ["store_operator", "store_manager", "viewer"], required: true },
    scopes: { type: [String], default: ["relay:request"] },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    revokedAt: Date,
    createdByAdminId: id
  },
  timestamps
);
UserAssignmentSchema.index(
  { appUserId: 1, organizationId: 1, storeId: 1, workerInstallationId: 1 },
  { unique: true }
);

const ClientDeviceSchema = new Schema(
  {
    deviceId: { ...id, unique: true },
    appUserId: id,
    audience: { type: String, enum: ["desktop", "mobile"], required: true },
    deviceName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    lastSeenAt: Date,
    revokedAt: Date
  },
  timestamps
);

const ClientRefreshCredentialSchema = new Schema(
  {
    refreshId: { ...id, unique: true },
    secretHash: { type: String, required: true, select: false },
    appUserId: id,
    assignmentId: id,
    deviceId: id,
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  timestamps
);

const ClientSessionSchema = new Schema(
  {
    clientSessionId: { ...id, unique: true },
    appUserId: id,
    assignmentId: id,
    deviceId: id,
    organizationId: id,
    storeId: id,
    workerInstallationId: id,
    audience: { type: String, enum: ["desktop", "mobile"], required: true },
    scopes: { type: [String], default: [] },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active" },
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  timestamps
);

const AuditEventSchema = new Schema(
  {
    ...tenant,
    auditEventId: { ...id, unique: true },
    storeId: String,
    workerInstallationId: String,
    actorType: {
      type: String,
      enum: ["internal_admin", "app_user", "worker", "system"],
      required: true
    },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    reason: String,
    correlationId: id,
    metadata: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true }
  },
  timestamps
);
AuditEventSchema.index({ organizationId: 1, occurredAt: -1 });

export const InternalAdminModel =
  models.InternalAdmin || model("InternalAdmin", InternalAdminSchema);
export const AdminSessionModel =
  models.AdminSession || model("AdminSession", AdminSessionSchema);
export const OrganizationModel =
  models.ControlPlaneOrganization || model("ControlPlaneOrganization", OrganizationSchema);
export const SubscriptionModel =
  models.ControlPlaneSubscription || model("ControlPlaneSubscription", SubscriptionSchema);
export const TenantStoreModel = models.ControlPlaneStore || model("ControlPlaneStore", TenantStoreSchema);
export const WorkerInstallationModel =
  models.WorkerInstallation || model("WorkerInstallation", WorkerInstallationSchema);
export const SetupKeyModel = models.SetupKey || model("SetupKey", SetupKeySchema);
export const EulaAcceptanceModel =
  models.EulaAcceptance || model("EulaAcceptance", EulaAcceptanceSchema);
export const WorkerCredentialModel =
  models.WorkerCredential || model("WorkerCredential", WorkerCredentialSchema);
export const RotationChallengeModel =
  models.RotationChallenge || model("RotationChallenge", RotationChallengeSchema);
export const AppUserModel = models.AppUser || model("AppUser", AppUserSchema);
export const UserAssignmentModel =
  models.UserAssignment || model("UserAssignment", UserAssignmentSchema);
export const ClientDeviceModel = models.ClientDevice || model("ClientDevice", ClientDeviceSchema);
export const ClientRefreshCredentialModel =
  models.ClientRefreshCredential || model("ClientRefreshCredential", ClientRefreshCredentialSchema);
export const ClientSessionModel =
  models.ClientSession || model("ClientSession", ClientSessionSchema);
export const AuditEventModel = models.AuditEvent || model("AuditEvent", AuditEventSchema);
