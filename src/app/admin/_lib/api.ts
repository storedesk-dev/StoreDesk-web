/**
 * Typed client for the control-plane admin API (docs/design/control-plane-admin.md, "API").
 *
 * Every fetch the admin UI makes goes through this module, so the request and
 * response shapes live in one place and can be diffed against the route
 * handlers. Failures always arrive as `{error: {code, message}}`; `ApiError`
 * carries the status, code and the message the operator sees.
 */

import type { StoreCapability } from "@/config/pages";

// ── Shared shapes ────────────────────────────────────────────────────────────

export type OrgStatus = "active" | "suspended" | "pending";
export type SubscriptionStatus = "trialing" | "active" | "suspended" | "cancelled" | "expired";
export type SubscriptionPlan = "trial" | "standard" | "custom";
export type StoreStatus = "pending" | "active" | "suspended" | "closed";
export type InstallationStatus =
  | "not_installed"
  | "installed"
  | "awaiting_activation"
  | "active"
  | "degraded"
  | "suspended"
  | "updating"
  | "rollback";
export type TunnelStatus = "ok" | "failed" | "missing" | "provisioning";
export type UserStatus = "pending_enrollment" | "active" | "disabled";
export type LoginType = "email" | "managed";
export type AppKey = "electron" | "mobile";

export interface Organization {
  organizationId: string;
  name: string;
  slug: string;
  billingEmail?: string | null;
  status: OrgStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** A row of `GET /organizations`: the organization plus its counts. */
export interface OrganizationSummary extends Organization {
  storeCount: number;
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionEndsAt?: string | null;
}

export interface OrganizationDetail {
  organization: Organization;
  counts?: { stores: number; roles: number; users: number };
}

export interface Subscription {
  subscriptionId: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startsAt?: string;
  entitlementExpiresAt: string;
  offlineGraceDays: number;
  /** Stores allowed on this subscription. */
  maxStores: number;
  /** PCs allowed per store. */
  maxWorkerInstallations: number;
  /** Stores currently on this subscription. */
  storeCount?: number;
}

export interface StoreInstallationSummary {
  workerInstallationId?: string;
  status: InstallationStatus;
  lastSeenAt?: string | null;
  activatedAt?: string | null;
}

export interface StoreTunnel {
  status: TunnelStatus;
  url?: string | null;
  message?: string | null;
}

export interface Store {
  storeId: string;
  organizationId: string;
  subscriptionId: string;
  name: string;
  storeNumber?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  status: StoreStatus;
  timeZone?: string | null;
  installation?: StoreInstallationSummary | null;
  tunnel?: StoreTunnel | null;
  createdAt?: string;
}

export interface StoreSettings {
  capabilities: Record<StoreCapability, boolean>;
  lottery: { setupMode: null };
  integrations: {
    googleSheets: {
      enabled: boolean;
      spreadsheetUrl: string | null;
      spreadsheetId: string | null;
      sheetName: string | null;
      headerRow: number;
    };
    gtc: { status: "coming_soon" };
  };
  timeZone: string | null;
}

export interface StoreSettingsResponse {
  settings: StoreSettings;
  settingsVersion: number;
  /** StoreDesk's Google account, when the deployment knows it. */
  googleClientEmail?: string | null;
}

export interface GoogleSheetCheck {
  clientEmail: string;
  spreadsheetId: string;
  title: string;
  sheets: string[];
}

export interface PosCredentials {
  posIpAddress: string;
  posUsername: string;
  passwordOnFile: boolean;
  secretStorageAvailable?: boolean;
}

export type SetupKeyStatus =
  | "queued"
  | "shown"
  | "sent"
  | "delivery_failed"
  | "consumed"
  | "expired"
  | "revoked";

export interface StoreSetup {
  installation: StoreInstallationSummary | null;
  setupKey: { keyId: string; status: SetupKeyStatus; expiresAt: string; createdAt?: string } | null;
  organizationSlug: string;
  contactEmail?: string | null;
  tunnel: StoreTunnel;
  /** Why a key cannot be issued right now (no tunnel, subscription ended, …), or null. */
  keyBlockedReason?: string | null;
}

export interface IssuedSetupKey {
  /** Present only for `deliver: "show"`; shown once. */
  setupKey?: string;
  keyId?: string;
  expiresAt: string;
  status: "shown" | "sent";
  sentTo?: string | null;
}

export interface PreviewPage {
  key: string;
  /** The capability the store lacks, when the role grants the page but the store hides it. */
  hiddenBecause?: StoreCapability | null;
}

export interface AccessPreview {
  capabilities: Record<StoreCapability, boolean>;
  roles: Array<{
    roleId: string;
    roleName: string;
    electron: PreviewPage[];
    mobile: PreviewPage[];
  }>;
}

export interface RolePage {
  key: string;
  enabled: boolean;
  featureFlags: Record<string, boolean>;
}

export interface RoleAccessKeys {
  electron: { pages: RolePage[] };
  mobile: { pages: RolePage[] };
}

export interface Role {
  roleId: string;
  roleName: string;
  version: number;
  updatedAt?: string;
  accessKeys: RoleAccessKeys;
  /** Active assignments naming this role. */
  userCount?: number;
}

export type RoleTemplate = "org_admin" | "store_manager" | "cashier" | "viewer" | "blank";

export interface Assignment {
  assignmentId: string;
  storeId: string | null;
  role: string;
  status: "active" | "revoked";
}

export interface AppUser {
  appUserId: string;
  email: string;
  name?: string | null;
  status: UserStatus;
  loginType?: LoginType;
  passwordSetBy?: "user" | "admin" | null;
  lastLoginAt?: string | null;
  assignments: Assignment[];
}

export interface AddUserInput {
  mode: "managed" | "invite";
  email: string;
  name?: string;
  password?: string;
  assignments: Array<{ storeId: string | null; role: string }>;
}

export interface AddUserResult {
  user: AppUser;
  /** True when the login already existed; its password was left alone. */
  existing: boolean;
  invitationCode?: string | null;
  invitationExpiresAt?: string | null;
  emailed?: boolean;
}

export interface Invitation {
  invitationCode: string;
  expiresAt?: string | null;
  emailed?: boolean;
}

export interface AuditEvent {
  auditEventId: string;
  occurredAt: string;
  actorType: string;
  actorId: string;
  /** e.g. the admin's e-mail, when the server resolves it. */
  actorLabel?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  /** e.g. the store or user name, when the server resolves it. */
  targetLabel?: string | null;
  organizationId?: string;
  organizationName?: string | null;
  storeId?: string | null;
}

export interface AuditPage {
  events: AuditEvent[];
  nextCursor: string | null;
  /** Distinct actions in this organization's log, for the filter. */
  actions?: string[];
}

export type AttentionKind =
  | "pc_not_activated"
  | "subscription_ending"
  | "tunnel_failed"
  | "store_offline";

export interface AttentionItem {
  kind: AttentionKind;
  organizationId: string;
  organizationName: string;
  storeId?: string | null;
  storeName?: string | null;
  subscriptionId?: string | null;
  /** Key issued / entitlement end / last seen, depending on the kind. */
  at?: string | null;
  message?: string | null;
}

export interface Dashboard {
  counts: {
    organizations: number;
    stores: number;
    pcsOnline: number;
    pcsTotal: number;
    subscriptionsEndingSoon: number;
  };
  attention: AttentionItem[];
  recentActivity: AuditEvent[];
}

// ── Transport ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly body: unknown = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Your session has ended. Sign in again.";
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "Not found. It may have been deleted, or this server doesn't have that route yet.";
  if (status === 409) return "That conflicts with something that changed elsewhere.";
  if (status === 429) return "Too many attempts. Wait a few minutes and try again.";
  if (status >= 500) return "The server couldn't do that right now. Try again in a moment.";
  return `Request failed (${status}).`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Couldn't reach the server. Check your connection.");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const raw = (data as { error?: unknown } | null)?.error;
    let code = `HTTP_${res.status}`;
    let message = fallbackMessage(res.status);
    if (raw && typeof raw === "object") {
      const e = raw as { code?: unknown; message?: unknown };
      if (typeof e.code === "string") code = e.code;
      if (typeof e.message === "string" && e.message) message = e.message;
    } else if (typeof raw === "string" && raw) {
      message = raw;
    }
    if (res.status === 401 && typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/admin-gate?next=${next}`;
    }
    throw new ApiError(res.status, code, message, data);
  }
  return data as T;
}

const enc = encodeURIComponent;
const ADMIN = "/api/v1/admin";
const org = (orgId: string) => `${ADMIN}/organizations/${enc(orgId)}`;
const store = (orgId: string, storeId: string) => `${org(orgId)}/stores/${enc(storeId)}`;
const user = (orgId: string, appUserId: string) => `${org(orgId)}/users/${enc(appUserId)}`;

// ── Routes ───────────────────────────────────────────────────────────────────

export const api = {
  // Staff session
  signIn: (email: string, password: string) =>
    request<{ ok: true; admin: { adminId: string; email: string } }>("POST", "/api/admin/login", {
      email,
      password
    }),
  signOut: () => request<{ ok: true }>("DELETE", "/api/admin/login"),

  // Dashboard
  dashboard: () => request<Dashboard>("GET", `${ADMIN}/dashboard`),

  // Organizations
  listOrganizations: () =>
    request<{ organizations: OrganizationSummary[] }>("GET", `${ADMIN}/organizations`),
  createOrganization: (input: {
    name: string;
    slug: string;
    billingEmail?: string;
    subscription?: {
      plan: SubscriptionPlan;
      entitlementDays: number;
      maxStores: number;
      maxWorkerInstallations: number;
      offlineGraceDays: number;
    };
  }) =>
    request<{ organization: Organization; subscription?: Subscription | null }>(
      "POST",
      `${ADMIN}/organizations`,
      input
    ),
  getOrganization: (orgId: string) => request<OrganizationDetail>("GET", org(orgId)),
  updateOrganization: (
    orgId: string,
    patch: Partial<{ name: string; slug: string; status: "active" | "suspended"; billingEmail: string }>
  ) => request<{ organization: Organization }>("PATCH", org(orgId), patch),
  deleteOrganization: (orgId: string, confirmSlug: string) =>
    request<{ deleted: string }>("DELETE", org(orgId), { confirmSlug }),

  // Subscriptions
  listSubscriptions: (orgId: string) =>
    request<{ subscriptions: Subscription[] }>("GET", `${org(orgId)}/subscriptions`),
  createSubscription: (
    orgId: string,
    input: {
      plan: SubscriptionPlan;
      entitlementDays: number;
      maxStores: number;
      maxWorkerInstallations: number;
      offlineGraceDays: number;
    }
  ) => request<{ subscription: Subscription }>("POST", `${org(orgId)}/subscriptions`, input),
  updateSubscription: (
    orgId: string,
    subscriptionId: string,
    patch: Partial<{
      plan: SubscriptionPlan;
      status: SubscriptionStatus;
      maxStores: number;
      maxWorkerInstallations: number;
      offlineGraceDays: number;
      renewDays: number;
    }>
  ) =>
    request<{ subscription: Subscription }>(
      "PATCH",
      `${org(orgId)}/subscriptions/${enc(subscriptionId)}`,
      patch
    ),

  // Stores
  listStores: (orgId: string) => request<{ stores: Store[] }>("GET", `${org(orgId)}/stores`),
  createStore: (
    orgId: string,
    input: {
      name: string;
      storeNumber?: string;
      address?: string;
      contactEmail?: string;
      timeZone?: string;
      subscriptionId: string;
    }
  ) => request<{ store: Store }>("POST", `${org(orgId)}/stores`, input),
  getStore: (orgId: string, storeId: string) => request<{ store: Store }>("GET", store(orgId, storeId)),
  updateStore: (
    orgId: string,
    storeId: string,
    patch: Partial<{
      name: string;
      storeNumber: string;
      address: string;
      contactEmail: string;
      status: StoreStatus;
    }>
  ) => request<{ store: Store }>("PATCH", store(orgId, storeId), patch),
  deleteStore: (orgId: string, storeId: string) =>
    request<{ deleted: string }>("DELETE", store(orgId, storeId)),

  // Store settings (features, integrations, time zone)
  getStoreSettings: (orgId: string, storeId: string) =>
    request<StoreSettingsResponse>("GET", `${store(orgId, storeId)}/settings`),
  saveStoreSettings: (orgId: string, storeId: string, settingsVersion: number, settings: StoreSettings) =>
    request<StoreSettingsResponse>("PUT", `${store(orgId, storeId)}/settings`, {
      settingsVersion,
      settings
    }),
  checkGoogleSheet: (orgId: string, storeId: string, spreadsheetUrl: string) =>
    request<GoogleSheetCheck>("POST", `${store(orgId, storeId)}/settings/google-sheets/check`, {
      spreadsheetUrl
    }),

  // Register
  getPosCredentials: (orgId: string, storeId: string) =>
    request<PosCredentials>("GET", `${store(orgId, storeId)}/pos-credentials`),
  savePosCredentials: (
    orgId: string,
    storeId: string,
    input: { posIpAddress: string; posUsername: string; posPassword?: string }
  ) => request<PosCredentials>("PUT", `${store(orgId, storeId)}/pos-credentials`, input),

  // PC & phones
  getStoreSetup: (orgId: string, storeId: string) =>
    request<StoreSetup>("GET", `${store(orgId, storeId)}/setup`),
  issueSetupKey: (orgId: string, storeId: string, deliver: "show" | "email") =>
    request<IssuedSetupKey>("POST", `${store(orgId, storeId)}/setup-keys`, { deliver }),
  replacePc: (orgId: string, storeId: string) =>
    request<{ installation: StoreInstallationSummary }>("POST", `${store(orgId, storeId)}/replace-pc`),
  retryTunnel: (orgId: string, storeId: string) =>
    request<{ tunnel: StoreTunnel }>("POST", `${store(orgId, storeId)}/tunnel`),

  // Access preview
  accessPreview: (orgId: string, storeId: string) =>
    request<AccessPreview>("GET", `${store(orgId, storeId)}/access-preview`),

  // Roles
  listRoles: (orgId: string) => request<{ roles: Role[] }>("GET", `${org(orgId)}/roles`),
  createRole: (
    orgId: string,
    input: { roleName: string; template: RoleTemplate; accessKeys: RoleAccessKeys }
  ) => request<{ role: Role }>("POST", `${org(orgId)}/roles`, input),
  saveRole: (
    orgId: string,
    roleId: string,
    input: { baseVersion: number; roleName: string; accessKeys: RoleAccessKeys }
  ) => request<{ role: Role }>("PUT", `${org(orgId)}/roles/${enc(roleId)}`, input),
  deleteRole: (orgId: string, roleId: string) =>
    request<{ deleted: string }>("DELETE", `${org(orgId)}/roles/${enc(roleId)}`),

  // Users
  listUsers: (orgId: string) => request<{ users: AppUser[] }>("GET", `${org(orgId)}/users`),
  addUser: (orgId: string, input: AddUserInput) =>
    request<AddUserResult>("POST", `${org(orgId)}/users`, input),
  updateUser: (orgId: string, appUserId: string, patch: Partial<{ name: string; status: "active" | "disabled" }>) =>
    request<{ user: AppUser }>("PATCH", user(orgId, appUserId), patch),
  setUserPassword: (orgId: string, appUserId: string, password: string) =>
    request<{ ok: true }>("POST", `${user(orgId, appUserId)}/password`, { password }),
  resendInvite: (orgId: string, appUserId: string) =>
    request<Invitation>("POST", `${user(orgId, appUserId)}/invite`),
  addAssignment: (orgId: string, appUserId: string, input: { storeId: string | null; role: string }) =>
    request<{ assignment: Assignment }>("POST", `${user(orgId, appUserId)}/assignments`, input),
  updateAssignment: (
    orgId: string,
    appUserId: string,
    assignmentId: string,
    patch: { storeId?: string | null; role?: string }
  ) =>
    request<{ assignment: Assignment }>(
      "PATCH",
      `${user(orgId, appUserId)}/assignments/${enc(assignmentId)}`,
      patch
    ),
  revokeAssignment: (orgId: string, appUserId: string, assignmentId: string) =>
    request<{ ok: true }>("DELETE", `${user(orgId, appUserId)}/assignments/${enc(assignmentId)}`),

  // Activity
  audit: (orgId: string, params: { cursor?: string | null; action?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.cursor) q.set("cursor", params.cursor);
    if (params.action) q.set("action", params.action);
    q.set("limit", String(params.limit ?? 50));
    return request<AuditPage>("GET", `${org(orgId)}/audit?${q.toString()}`);
  }
};

/** Every route this module calls, for diffing against the route handlers. */
export const ADMIN_ROUTES = [
  "POST   /api/admin/login",
  "DELETE /api/admin/login",
  "GET    /api/v1/admin/dashboard",
  "GET    /api/v1/admin/organizations",
  "POST   /api/v1/admin/organizations",
  "GET    /api/v1/admin/organizations/{org}",
  "PATCH  /api/v1/admin/organizations/{org}",
  "DELETE /api/v1/admin/organizations/{org}",
  "GET    /api/v1/admin/organizations/{org}/subscriptions",
  "POST   /api/v1/admin/organizations/{org}/subscriptions",
  "PATCH  /api/v1/admin/organizations/{org}/subscriptions/{sub}",
  "GET    /api/v1/admin/organizations/{org}/stores",
  "POST   /api/v1/admin/organizations/{org}/stores",
  "GET    /api/v1/admin/organizations/{org}/stores/{store}",
  "PATCH  /api/v1/admin/organizations/{org}/stores/{store}",
  "DELETE /api/v1/admin/organizations/{org}/stores/{store}",
  "GET    /api/v1/admin/organizations/{org}/stores/{store}/settings",
  "PUT    /api/v1/admin/organizations/{org}/stores/{store}/settings",
  "POST   /api/v1/admin/organizations/{org}/stores/{store}/settings/google-sheets/check",
  "GET    /api/v1/admin/organizations/{org}/stores/{store}/pos-credentials",
  "PUT    /api/v1/admin/organizations/{org}/stores/{store}/pos-credentials",
  "GET    /api/v1/admin/organizations/{org}/stores/{store}/setup",
  "POST   /api/v1/admin/organizations/{org}/stores/{store}/setup-keys",
  "POST   /api/v1/admin/organizations/{org}/stores/{store}/replace-pc",
  "POST   /api/v1/admin/organizations/{org}/stores/{store}/tunnel",
  "GET    /api/v1/admin/organizations/{org}/stores/{store}/access-preview",
  "GET    /api/v1/admin/organizations/{org}/roles",
  "POST   /api/v1/admin/organizations/{org}/roles",
  "PUT    /api/v1/admin/organizations/{org}/roles/{roleId}",
  "DELETE /api/v1/admin/organizations/{org}/roles/{roleId}",
  "GET    /api/v1/admin/organizations/{org}/users",
  "POST   /api/v1/admin/organizations/{org}/users",
  "PATCH  /api/v1/admin/organizations/{org}/users/{appUserId}",
  "POST   /api/v1/admin/organizations/{org}/users/{appUserId}/password",
  "POST   /api/v1/admin/organizations/{org}/users/{appUserId}/invite",
  "POST   /api/v1/admin/organizations/{org}/users/{appUserId}/assignments",
  "PATCH  /api/v1/admin/organizations/{org}/users/{appUserId}/assignments/{id}",
  "DELETE /api/v1/admin/organizations/{org}/users/{appUserId}/assignments/{id}",
  "GET    /api/v1/admin/organizations/{org}/audit?cursor&action&limit"
] as const;
