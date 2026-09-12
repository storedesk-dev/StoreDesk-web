import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  OrganizationModel,
  SubscriptionModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import {
  CONTRACT_VERSION,
  ControlPlaneError,
  canonicalJson,
  safeJson,
  sha256
} from "@/lib/control-plane-security";
import { normalizeRoles, toIsoOr, type OrgRole } from "@/lib/roles";

/**
 * `GET /api/v1/edge/sync/access` — everything a store server needs to sign its
 * own users in (docs/design/store-sign-in-and-sync.md).
 *
 * This is the ONE response that carries password hashes. They leave only here,
 * only to the calling installation (worker credential), only for users
 * assigned to it, and only for `status: "active"` users. `safeJson()` would
 * strip `passwordHash`, and must keep doing so everywhere else, so the users
 * array is assembled from an explicit field list AFTER the rest of the body
 * went through the scrubber.
 */

type Doc = Record<string, unknown>;

export type AccessSyncUser = {
  appUserId: string;
  email: string;
  name: string | null;
  status: string;
  passwordHash?: string;
  passwordChangedAt: string | null;
  assignment: { assignmentId: string; role: string; scopes: string[] };
};

export type AccessSyncBody = {
  contractVersion: string;
  version: string;
  generatedAt: string;
  organization: { organizationId: string; slug: string; name: string; status: string };
  store: {
    storeId: string;
    name: string;
    storeNumber: string | null;
    status: string;
    tunnelUrl: string | null;
  };
  subscription: { status: string; entitlementExpiresAt: string | null; offlineGraceDays: number };
  roles: OrgRole[];
  users: AccessSyncUser[];
};

const EPOCH = "1970-01-01T00:00:00.000Z";
const DEFAULT_OFFLINE_GRACE_DAYS = 7;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function optionalText(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : String(value);
}

/**
 * Which assignment of each user applies to this installation. An assignment
 * names an installation, or only a store (the admin UI's "Store #…"), or
 * neither (the admin UI's "All Stores" — organization-wide). The most specific
 * wins; a tie goes to the lowest assignmentId so the answer is stable.
 * Assignments to another store or installation are ignored.
 */
export function pickAssignmentsForInstallation(
  assignments: Doc[],
  target: { organizationId: string; storeId: string; workerInstallationId: string }
): Map<string, Doc> {
  const rank = (assignment: Doc): number => {
    if (text(assignment.organizationId) !== target.organizationId) return -1;
    if (text(assignment.status || "active") !== "active") return -1;
    const installation = text(assignment.workerInstallationId);
    const store = text(assignment.storeId);
    if (installation) return installation === target.workerInstallationId ? 0 : -1;
    if (store) return store === target.storeId ? 1 : -1;
    return 2;
  };
  const picked = new Map<string, { assignment: Doc; rank: number }>();
  for (const assignment of assignments) {
    const r = rank(assignment);
    if (r < 0) continue;
    const appUserId = text(assignment.appUserId);
    if (!appUserId) continue;
    const current = picked.get(appUserId);
    if (
      !current ||
      r < current.rank ||
      (r === current.rank && text(assignment.assignmentId) < text(current.assignment.assignmentId))
    ) {
      picked.set(appUserId, { assignment, rank: r });
    }
  }
  return new Map([...picked].map(([id, entry]) => [id, entry.assignment]));
}

/** Explicit field list. `passwordHash` only for an active user that has one. */
export function accessSyncUser(user: Doc, assignment: Doc): AccessSyncUser {
  const status = text(user.status);
  const hash =
    status === "active" && typeof user.passwordHash === "string" && user.passwordHash
      ? user.passwordHash
      : undefined;
  const scopes = Array.isArray(assignment.scopes)
    ? assignment.scopes.filter((scope): scope is string => typeof scope === "string")
    : ["relay:request"];
  return {
    appUserId: text(user.appUserId),
    email: text(user.email).toLowerCase(),
    name: optionalText(user.name),
    status,
    ...(hash ? { passwordHash: hash } : {}),
    passwordChangedAt: hash
      ? toIsoOr(user.passwordChangedAt ?? user.enrollmentConsumedAt ?? user.updatedAt, EPOCH)
      : null,
    assignment: {
      assignmentId: text(assignment.assignmentId),
      role: text(assignment.role),
      scopes
    }
  };
}

/** The stable content hash: everything except `generatedAt` (and itself). */
export function accessSyncVersion(body: Omit<AccessSyncBody, "version" | "generatedAt">): string {
  return sha256(canonicalJson(body));
}

export function buildAccessSyncBody(input: {
  organization: Doc;
  store: Doc;
  subscription: Doc | null;
  roles: OrgRole[];
  users: Array<{ user: Doc; assignment: Doc }>;
  generatedAt: Date;
}): AccessSyncBody {
  const { organization, store, subscription } = input;
  // Everything but users goes through the scrubber, like any other response.
  const scrubbed = safeJson({
    organization: {
      organizationId: text(organization.organizationId),
      slug: text(organization.slug),
      name: text(organization.name),
      status: text(organization.status)
    },
    store: {
      storeId: text(store.storeId),
      name: text(store.name),
      storeNumber: optionalText(store.storeNumber),
      status: text(store.status),
      tunnelUrl: optionalText(store.tunnelUrl)
    },
    subscription: subscription
      ? {
          status: text(subscription.status),
          entitlementExpiresAt:
            subscription.entitlementExpiresAt === undefined || subscription.entitlementExpiresAt === null
              ? null
              : toIsoOr(subscription.entitlementExpiresAt, EPOCH),
          offlineGraceDays:
            typeof subscription.offlineGraceDays === "number"
              ? subscription.offlineGraceDays
              : DEFAULT_OFFLINE_GRACE_DAYS
        }
      : // The installation's subscription is gone: the store refuses sign-in.
        { status: "none", entitlementExpiresAt: null, offlineGraceDays: DEFAULT_OFFLINE_GRACE_DAYS }
  });
  // Roles are already reduced to key / enabled / boolean flags by
  // normalizeRoles, so nothing in them can be a secret — and running them
  // through the name-based scrubber would silently drop a flag such as
  // `requireManagerPassword`.
  const roles = input.roles;
  // The deliberate exception: built after scrubbing, from an explicit list.
  const users = input.users
    .map(({ user, assignment }) => accessSyncUser(user, assignment))
    .sort((a, b) => (a.appUserId < b.appUserId ? -1 : a.appUserId > b.appUserId ? 1 : 0));

  const content = {
    contractVersion: CONTRACT_VERSION,
    organization: scrubbed.organization,
    store: scrubbed.store,
    subscription: scrubbed.subscription,
    roles,
    users
  };
  return {
    contractVersion: CONTRACT_VERSION,
    version: accessSyncVersion(content),
    generatedAt: input.generatedAt.toISOString(),
    organization: content.organization,
    store: content.store,
    subscription: content.subscription,
    roles,
    users
  };
}

/** Loads and builds the body for one authenticated installation. */
export async function loadAccessSync(worker: {
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
}): Promise<AccessSyncBody> {
  await connectDb();
  const { organizationId, storeId, workerInstallationId } = worker;
  const [organization, store, installation] = (await Promise.all([
    OrganizationModel.findOne({ organizationId }).lean(),
    TenantStoreModel.findOne({ organizationId, storeId }).lean(),
    WorkerInstallationModel.findOne({ organizationId, storeId, workerInstallationId }).lean()
  ])) as [Doc | null, Doc | null, Doc | null];
  if (!organization || !store || !installation) {
    throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Resource not found");
  }

  const subscriptionId = text(installation.subscriptionId) || text(store.subscriptionId);
  const subscription = subscriptionId
    ? ((await SubscriptionModel.findOne({ organizationId, subscriptionId }).lean()) as Doc | null)
    : null;

  const unset = { $in: [null, ""] };
  const assignments = (await UserAssignmentModel.find({
    organizationId,
    status: "active",
    $or: [
      { workerInstallationId },
      { workerInstallationId: unset, storeId },
      { workerInstallationId: unset, storeId: unset }
    ]
  }).lean()) as Doc[];
  const picked = pickAssignmentsForInstallation(assignments, worker);

  // Selected explicitly: `passwordHash` is `select: false` on the model.
  const appUsers = picked.size
    ? ((await AppUserModel.find({ appUserId: { $in: [...picked.keys()] } })
        .select("+passwordHash")
        .lean()) as Doc[])
    : [];
  const users = appUsers
    .map((user) => ({ user, assignment: picked.get(text(user.appUserId)) }))
    .filter((entry): entry is { user: Doc; assignment: Doc } => Boolean(entry.assignment));

  return buildAccessSyncBody({
    organization,
    store,
    subscription,
    roles: normalizeRoles(organization.roles, toIsoOr(organization.createdAt, EPOCH)),
    users,
    generatedAt: new Date()
  });
}
