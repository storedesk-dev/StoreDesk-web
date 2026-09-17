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
    /**
     * The org tag phones type. New and edited slugs must match ORG_SLUG in
     * lib/organizations.ts; older slugs that don't keep working for lookup.
     */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    billingEmail: { type: String, lowercase: true, trim: true },
    // `pending` only for records written by older builds; admins set active | suspended.
    status: { type: String, enum: ["pending", "active", "suspended"], default: "active" },
    roles: { type: Schema.Types.Mixed, default: [] },
    /**
     * How the organization is licensed (lib/licenses.ts): `master` — one master
     * license covers every store — or `storeWise` — each store has its own
     * license or none. Set on create; older records get it from the migration.
     */
    licensing: {
      mode: { type: String, enum: ["master", "storeWise"] }
    }
  },
  timestamps
);

const SubscriptionSchema = new Schema(
  {
    ...tenant,
    subscriptionId: { ...id, unique: true },
    plan: { type: String, enum: ["trial", "standard", "custom"], required: true },
    /** `expired` is written by a check on read once `entitlementExpiresAt` has passed. */
    status: {
      type: String,
      enum: ["trialing", "active", "suspended", "cancelled", "expired"],
      required: true
    },
    startsAt: { type: Date, required: true },
    supportEndsAt: { type: Date, required: true },
    entitlementExpiresAt: { type: Date, required: true },
    offlineGraceDays: { type: Number, min: 0, max: 30, default: 7 },
    /** Counts the stores on this subscription. */
    maxStores: { type: Number, min: 1, required: true },
    /** Per store. */
    maxWorkerInstallations: { type: Number, min: 1, required: true }
  },
  timestamps
);

/**
 * Licenses (docs/design/control-plane-admin.md, "Licenses"). In a master-mode
 * organization its one organization license (the master) covers every store;
 * in a store-wise one each store license covers its one store. Which license
 * covers a store is derived from the mode (lib/licenses.ts), never stored.
 */
const LicenseSchema = new Schema(
  {
    ...tenant,
    licenseId: { ...id, unique: true },
    /** Readable, shown on screens and in the audit: SD-ORG-XXXXXX / SD-STR-XXXXXX. */
    licenseNumber: { type: String, required: true, unique: true },
    scope: { type: String, enum: ["organization", "store"], required: true },
    /** Required when scope is "store". */
    storeId: { type: String, index: true },
    plan: { type: String, enum: ["trial", "standard", "custom"], required: true },
    /** `expired` is written by a check on read once `entitlementExpiresAt` has passed. */
    status: {
      type: String,
      enum: ["trialing", "active", "suspended", "cancelled", "expired"],
      required: true
    },
    startsAt: { type: Date, required: true },
    entitlementExpiresAt: { type: Date, required: true },
    offlineGraceDays: { type: Number, min: 0, max: 30, default: 7 },
    /** Unused: the master license has no store limit. Kept (and ignored) on older records. */
    maxStores: { type: Number, min: 1, default: 1 },
    maxPcsPerStore: { type: Number, min: 1, default: 1 },
    notes: { type: String, trim: true, maxlength: 1000 },
    /**
     * `org:<organizationId>` or `store:<storeId>` while the license is not
     * cancelled, unset once it is. Its unique index is what allows at most one
     * non-cancelled organization license per organization and one
     * non-cancelled store license per store.
     */
    coverageKey: { type: String },
    migratedFromSubscription: { type: Boolean }
  },
  timestamps
);
LicenseSchema.index(
  { coverageKey: 1 },
  { unique: true, partialFilterExpression: { coverageKey: { $type: "string" } } }
);

/**
 * Structured store settings (docs/design/control-plane-admin.md). Older
 * records have none of these paths; lib/store-settings.ts reads a missing
 * value as its default.
 */
const StoreSettingsSchema = new Schema(
  {
    // true / false once the owner or an admin answers; null until then ("not
    // answered"), which every consumer reads as present (StoreCapabilitySet).
    capabilities: {
      lottery: { type: Boolean, default: null },
      coam: { type: Boolean, default: null },
      fuel: { type: Boolean, default: null },
      ebt: { type: Boolean, default: null },
      moneyOrder: { type: Boolean, default: null },
      prepaidGift: { type: Boolean, default: null }
    },
    lottery: {
      // The recording choices are "Coming soon"; null until one ships.
      setupMode: { type: String, default: null }
    },
    integrations: {
      googleSheets: {
        enabled: { type: Boolean, default: false },
        spreadsheetUrl: { type: String, default: null },
        spreadsheetId: { type: String, default: null },
        sheetName: { type: String, default: null },
        headerRow: { type: Number, min: 1, max: 1000, default: 1 }
      },
      gtc: {
        status: { type: String, enum: ["coming_soon"], default: "coming_soon" }
      }
    },
    timeZone: { type: String, default: null }
  },
  { _id: false }
);

const TenantStoreSchema = new Schema(
  {
    ...tenant,
    storeId: { ...id, unique: true },
    // No license link: coverage follows from the organization's licensing mode
    // (lib/licenses.ts). The migration removes the older licenseId / subscriptionId.
    name: { type: String, required: true, trim: true },
    storeNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    contactEmail: { type: String, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "active", "suspended", "closed"], default: "active" },
    settings: { type: StoreSettingsSchema, default: () => ({}) },
    /** +1 on every settings change; a missing value reads as 1. */
    settingsVersion: { type: Number, min: 1, default: 1 },
    tunnelUrl: { type: String, trim: true },
    /** Hostname label the tunnel was (or will be) created under. */
    tunnelLabel: { type: String, trim: true },
    /** Last provisioning outcome; a store with a tunnelUrl reads as provisioned. */
    tunnelStatus: { type: String, enum: ["provisioned", "not_configured", "failed"] },
    tunnelError: { type: String },
    tunnelUpdatedAt: Date,
    /** Cloudflare ids saved when provisioning succeeded; delete and rotate go by these, never by name. */
    tunnelId: { type: String },
    tunnelDnsRecordId: { type: String },
    /** The PC was replaced and the tunnel secret is not rotated yet: no setup key until it is. */
    tunnelRotationRequired: { type: Boolean },
    tunnelRotatedAt: Date,
    /** Set when the store's tunnel was deleted; the config sync then answers `tunnel.state: "deleted"`. */
    tunnelDeletedAt: Date,
    /**
     * Last observed remote reachability (lib/remote-status.ts) and since when,
     * for a `since` when Cloudflare gives no timestamp. Unknown is not stored.
     */
    remoteStatus: { type: String, enum: ["online", "offline"] },
    remoteStatusSince: Date,
    /**
     * Register connection only (`posIntegration`, `posIpAddress`,
     * `posUsername`), built by the server — no route accepts a client-supplied
     * configJson, and it never carries roles or the register password.
     */
    configJson: { type: String },
    // Bearer credential for the store hostname. Never selected by default —
    // read it explicitly (`.select("+cloudflareToken")`) at the two places
    // that are allowed to: the audited admin reveal, and edge config sync.
    cloudflareToken: { type: String, trim: true, select: false },
    /**
     * Verifone Commander password, AES-256-GCM encrypted (see lib/store-secrets).
     * Set from the control plane or pushed up by the Worker; delivered only to
     * the authenticated Worker, never to a browser or a phone, and never inside
     * configJson — that blob reaches every signed-in client of the store.
     */
    posPasswordCipher: { type: String, select: false }
  },
  timestamps
);

const WorkerInstallationSchema = new Schema(
  {
    ...tenant,
    workerInstallationId: { ...id, unique: true },
    storeId: { type: String, index: true },
    /** Older builds only; entitlement comes from the store's covering license. */
    subscriptionId: { type: String },
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
    electronVersion: String,
    workerCredentialId: String,
    eulaAcceptanceId: String,
    activatedAt: Date,
    firstBootstrapCompletedAt: Date,
    bootstrapVersion: String,
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
    storeId: { type: String, index: true },
    workerInstallationId: { type: String, index: true },
    /** Older builds only; redeem checks the store's covering license. */
    subscriptionId: { type: String },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    /**
     * `shown`: handed to the admin once, on screen. `sent` / `delivery_failed`:
     * e-mailed to the store contact (the admin still sees it once). `queued`
     * is only on records written by older builds.
     */
    status: {
      type: String,
      enum: ["queued", "shown", "sent", "delivery_failed", "consumed", "expired", "revoked"],
      default: "shown"
    },
    /**
     * Reusable store key (owner decision 2026-09-17, "Replace PC"): it never
     * expires and is not used up. Redeeming it activates a PC for the same
     * installation and replaces whichever PC held it (old credential revoked,
     * tunnel secret rotated). Valid until an admin rotates it. False on the
     * single-use keys older builds issued.
     */
    reusable: { type: Boolean, default: false },
    /**
     * The key's secret sealed with STORE_SECRET_KEY (lib/store-secrets.ts), so
     * an authorised admin, or the store's own PC, can read the key again.
     * `select: false`, and named so safeJson() scrubs it. Missing when
     * STORE_SECRET_KEY was not configured at issue: the key works but can't be
     * shown again until it is rotated.
     */
    sealedSecret: { type: String, select: false },
    /** Single-use keys only; reusable keys never expire. */
    expiresAt: {
      type: Date,
      required(this: { reusable?: boolean }) {
        return !this.reusable;
      },
      index: true
    },
    /** The first redeem. */
    consumedAt: Date,
    /** Reusable keys: the latest redeem and how many activations the key has made. */
    lastRedeemedAt: Date,
    redeemCount: { type: Number, default: 0 },
    revokedAt: Date,
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 8 },
    deliveryProvider: String,
    deliveryMessageId: String,
    deliveryError: String,
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
    workerInstallationId: { type: String, index: true },
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
    /**
     * Per-installation HMAC key. Web signs client session tokens with it; the
     * Worker verifies them offline. Rotating the credential rotates this key,
     * which invalidates every outstanding session for the store.
     */
    relayKey: { type: String, required: true, select: false },
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

/**
 * Electron/Mobile product identity — cannot access Web admin. No organization
 * field: a login belongs to organizations through its assignments.
 */
const AppUserSchema = new Schema(
  {
    appUserId: { ...id, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    /**
     * argon2id. `select: false` and scrubbed by safeJson(); it leaves the
     * control plane only in GET /api/v1/edge/sync/access, to the store
     * servers the user is assigned to.
     */
    passwordHash: { type: String, select: false },
    passwordChangedAt: Date,
    status: { type: String, enum: ["pending_enrollment", "active", "disabled"], default: "pending_enrollment" },
    /**
     * `email`: invited, sets their own password at /enroll. `managed`: login
     * and password set by a StoreDesk admin; only an admin changes it. Missing
     * on older records, which read as `email`.
     */
    loginType: { type: String, enum: ["email", "managed"], default: "email" },
    passwordSetBy: { type: String, enum: ["user", "admin"] },
    /**
     * The organization whose admin created this login. Only that organization
     * may set its password or change its status, and only while no other
     * organization has it (lib/users.ts). Missing on older records.
     */
    createdInOrganizationId: { type: String, index: true },
    enrollmentSecretHash: { type: String, select: false },
    enrollmentExpiresAt: Date,
    enrollmentConsumedAt: Date,
    lastLoginAt: Date,
    createdByAdminId: id
  },
  timestamps
);

/**
 * Scope: one store (`storeId`) or the whole organization (no `storeId`).
 * `workerInstallationId` is only on records written by older builds; no route
 * creates an installation-scoped assignment any more. `role` must be one of
 * the organization's role ids (checked by lib/users.ts).
 */
const UserAssignmentSchema = new Schema(
  {
    assignmentId: { ...id, unique: true },
    appUserId: id,
    organizationId: id,
    storeId: { type: String, index: true },
    workerInstallationId: { type: String, index: true },
    role: { type: String, required: true },
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

/**
 * Staff sign-in failure counters, per hashed address and per hashed e-mail,
 * shared by every server instance. A TTL index drops a window once it ends.
 */
const LoginThrottleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true }
  },
  { versionKey: false }
);
LoginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Support codes (lib/support-codes.ts): StoreDesk staff issue one for a store;
 * that store's PC redeems it once, within 30 minutes, to unlock troubleshooting
 * at a stuck sign-in. Only the SHA-256 of the code is stored.
 */
const SupportCodeSchema = new Schema(
  {
    ...tenant,
    supportCodeId: { ...id, unique: true },
    storeId: id,
    codeHash: { type: String, required: true, unique: true, select: false },
    /** `expired` is not stored: it is `active` past `expiresAt`. */
    status: { type: String, enum: ["active", "used", "revoked"], default: "active" },
    expiresAt: { type: Date, required: true },
    issuedByAdminId: id,
    /** The staff member's name (or e-mail), as the store PC is told. */
    issuedBy: { type: String, required: true },
    usedAt: Date,
    usedByInstallationId: String,
    revokedAt: Date,
    revokedByAdminId: String
  },
  timestamps
);

export const SupportCodeModel = models.SupportCode || model("SupportCode", SupportCodeSchema);
export const LoginThrottleModel = models.LoginThrottle || model("LoginThrottle", LoginThrottleSchema);
export const InternalAdminModel =
  models.InternalAdmin || model("InternalAdmin", InternalAdminSchema);
export const AdminSessionModel =
  models.AdminSession || model("AdminSession", AdminSessionSchema);
export const OrganizationModel =
  models.ControlPlaneOrganization || model("ControlPlaneOrganization", OrganizationSchema);
/**
 * Subscriptions from older builds. Read only by the license migration
 * (lib/migrations.ts), which turns each into a license with the same id.
 */
export const LegacySubscriptionModel =
  models.ControlPlaneSubscription || model("ControlPlaneSubscription", SubscriptionSchema);
export const LicenseModel = models.ControlPlaneLicense || model("ControlPlaneLicense", LicenseSchema);
export const TenantStoreModel = models.ControlPlaneStore || model("ControlPlaneStore", TenantStoreSchema);
export const WorkerInstallationModel =
  models.WorkerInstallation || model("WorkerInstallation", WorkerInstallationSchema);
export const SetupKeyModel = models.SetupKey || model("SetupKey", SetupKeySchema);
export const EulaAcceptanceModel =
  models.EulaAcceptance || model("EulaAcceptance", EulaAcceptanceSchema);
export const WorkerCredentialModel =
  models.WorkerCredential || model("WorkerCredential", WorkerCredentialSchema);
export const AppUserModel = models.AppUser || model("AppUser", AppUserSchema);
export const UserAssignmentModel =
  models.UserAssignment || model("UserAssignment", UserAssignmentSchema);
export const ClientDeviceModel = models.ClientDevice || model("ClientDevice", ClientDeviceSchema);
export const AuditEventModel = models.AuditEvent || model("AuditEvent", AuditEventSchema);
