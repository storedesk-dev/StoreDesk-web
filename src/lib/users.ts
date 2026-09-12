import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AppUserModel, TenantStoreModel, UserAssignmentModel } from "@/models/ControlPlane";
import { ControlPlaneError, hashSecret, publicId, randomSecret } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { loginSchema, notFound, optionalText } from "@/lib/http";
import { getEmailProvider, isEmailConfigured } from "@/lib/email-provider";
import { normalizeRoles, toIsoOr, type OrgRole } from "@/lib/roles";
import { requireOrganization } from "@/lib/organizations";
import { scheduleAppUserNotify, scheduleNotify, type NotifyReason } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Users of an organization (owner decision 5, P1, P16). One path creates
 * logins (`appu_`) and assignments (`assign_`):
 *
 * - `mode: "managed"`: the admin sets the login and password; the user is
 *   active at once and only a StoreDesk admin changes the password.
 * - `mode: "invite"`: the user is pending with an invitation code (shown once,
 *   e-mailed when e-mail is configured) and sets their password at /enroll.
 *
 * A login that already exists is never modified here — not its password, not
 * its name, not its status. Only the assignments are added (`existing: true`).
 * Password changes are their own audited admin action.
 */

type Doc = Record<string, unknown>;

export const PASSWORD_MIN = 8;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EPOCH = "1970-01-01T00:00:00.000Z";

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `The password must be at least ${PASSWORD_MIN} characters`)
  .max(200);

const AssignmentInputSchema = z
  .object({
    /** A store of this organization, or null for every store. */
    storeId: z.string().trim().min(1).max(80).nullable(),
    role: z.string().trim().min(1).max(40)
  })
  .strict();
export type AssignmentInput = z.output<typeof AssignmentInputSchema>;

const addUserFields = {
  /** The login. `login` is accepted as another name for it. */
  email: loginSchema.optional(),
  login: loginSchema.optional(),
  name: optionalText(120).optional(),
  assignments: z.array(AssignmentInputSchema).min(1, "Give at least one store and role").max(50)
};

export const AddUserSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("managed"), ...addUserFields, password: passwordSchema }),
  z.object({ mode: z.literal("invite"), ...addUserFields, password: z.string().max(200).optional() })
]);
export type AddUser = z.output<typeof AddUserSchema>;

export const UserPatchSchema = z
  .object({
    name: optionalText(120).optional(),
    status: z.enum(["active", "disabled"]).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" });

export const SetPasswordSchema = z.object({ password: passwordSchema }).strict();

export const AssignmentCreateSchema = AssignmentInputSchema;
export const AssignmentPatchSchema = z
  .object({
    storeId: z.string().trim().min(1).max(80).nullable().optional(),
    role: z.string().trim().min(1).max(40).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" });

// ── Views ────────────────────────────────────────────────────────────────────

const iso = (value: unknown): string | null => (value ? toIsoOr(value, "") || null : null);

type Lookup = { stores: Map<string, string>; roles: Map<string, string> };

function assignmentView(assignment: Doc, lookup?: Lookup) {
  const storeId = assignment.storeId ? String(assignment.storeId) : null;
  const role = String(assignment.role);
  return {
    assignmentId: String(assignment.assignmentId),
    organizationId: String(assignment.organizationId),
    storeId,
    storeName: storeId ? (lookup?.stores.get(storeId) ?? null) : null,
    workerInstallationId: assignment.workerInstallationId ? String(assignment.workerInstallationId) : null,
    role,
    roleName: lookup?.roles.get(role) ?? null,
    status: String(assignment.status ?? "active"),
    createdAt: iso(assignment.createdAt)
  };
}

export function userView(user: Doc, assignments: Doc[] = [], lookup?: Lookup) {
  const pending = user.status === "pending_enrollment";
  const expires = user.enrollmentExpiresAt ? new Date(String(user.enrollmentExpiresAt)) : null;
  return {
    appUserId: String(user.appUserId),
    email: String(user.email),
    name: user.name ? String(user.name) : null,
    status: String(user.status),
    loginType: user.loginType === "managed" ? "managed" : "email",
    passwordSetBy: user.passwordSetBy ? String(user.passwordSetBy) : null,
    lastLoginAt: iso(user.lastLoginAt),
    createdAt: iso(user.createdAt),
    invitation: pending
      ? { expiresAt: expires ? expires.toISOString() : null, expired: Boolean(expires && expires.getTime() <= Date.now()) }
      : null,
    assignments: assignments.map((assignment) => assignmentView(assignment, lookup))
  };
}

async function lookupFor(organizationId: string, org?: Doc): Promise<Lookup> {
  const organization = org ?? (await requireOrganization(organizationId));
  const stores = (await TenantStoreModel.find({ organizationId }).select("storeId name").lean()) as Doc[];
  return {
    stores: new Map(stores.map((store) => [String(store.storeId), String(store.name)])),
    roles: new Map(orgRoles(organization).map((role) => [role.roleId, role.roleName]))
  };
}

function orgRoles(org: Doc): OrgRole[] {
  return normalizeRoles(org.roles, toIsoOr(org.createdAt, EPOCH));
}

export async function listUsers(organizationId: string) {
  const org = await requireOrganization(organizationId);
  const assignments = (await UserAssignmentModel.find({ organizationId, status: "active" })
    .sort({ createdAt: 1 })
    .lean()) as Doc[];
  const ids = [...new Set(assignments.map((row) => String(row.appUserId)))];
  const users = (await AppUserModel.find({ appUserId: { $in: ids } }).sort({ email: 1 }).lean()) as Doc[];
  const lookup = await lookupFor(organizationId, org);
  return users.map((user) =>
    userView(
      user,
      assignments.filter((row) => row.appUserId === user.appUserId),
      lookup
    )
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Every role must exist in the organization and every store belong to it (P9). */
async function validateAssignments(organizationId: string, org: Doc, inputs: AssignmentInput[]) {
  const roleIds = new Set(orgRoles(org).map((role) => role.roleId));
  const storeIds = new Set(
    ((await TenantStoreModel.find({ organizationId }).select("storeId").lean()) as Doc[]).map((row) => String(row.storeId))
  );
  const scopes = new Set<string>();
  for (const input of inputs) {
    if (!roleIds.has(input.role)) {
      throw new ControlPlaneError(400, "ROLE_UNKNOWN", `role: "${input.role}" is not a role of this organization`);
    }
    if (input.storeId !== null && !storeIds.has(input.storeId)) {
      throw new ControlPlaneError(400, "STORE_UNKNOWN", `storeId: "${input.storeId}" is not a store of this organization`);
    }
    const scope = input.storeId ?? "*";
    if (scopes.has(scope)) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "assignments: the same store is listed twice");
    }
    scopes.add(scope);
  }
}

/** The one assignment a user can have at a scope (the collection's unique index). */
function scopeFilter(appUserId: string, organizationId: string, storeId: string | null) {
  return { appUserId, organizationId, storeId: storeId ?? null, workerInstallationId: null };
}

type Upserted = { assignment: Doc; outcome: "created" | "reactivated" | "exists" };

async function upsertAssignment(
  admin: InternalAdminActor,
  organizationId: string,
  appUserId: string,
  input: AssignmentInput
): Promise<Upserted> {
  const existing = (await UserAssignmentModel.findOne(scopeFilter(appUserId, organizationId, input.storeId)).lean()) as Doc | null;
  if (existing?.status === "active") return { assignment: existing, outcome: "exists" };
  if (existing) {
    const assignment = (await UserAssignmentModel.findOneAndUpdate(
      { assignmentId: existing.assignmentId },
      { $set: { status: "active", role: input.role, createdByAdminId: admin.adminId }, $unset: { revokedAt: 1 } },
      { returnDocument: "after" }
    ).lean()) as Doc;
    await auditAssignment(admin, "assignment.create", assignment, { reactivated: true });
    return { assignment, outcome: "reactivated" };
  }
  const created = await UserAssignmentModel.create({
    assignmentId: publicId("assign"),
    appUserId,
    organizationId,
    ...(input.storeId ? { storeId: input.storeId } : {}),
    role: input.role,
    scopes: ["relay:request"],
    status: "active",
    createdByAdminId: admin.adminId
  });
  const assignment = created.toObject() as Doc;
  await auditAssignment(admin, "assignment.create", assignment);
  return { assignment, outcome: "created" };
}

function auditAssignment(admin: InternalAdminActor, action: string, assignment: Doc, extra: Doc = {}) {
  return auditAdmin(admin, {
    organizationId: String(assignment.organizationId),
    storeId: assignment.storeId ? String(assignment.storeId) : undefined,
    action,
    targetType: "user_assignment",
    targetId: String(assignment.assignmentId),
    metadata: { appUserId: assignment.appUserId, storeId: assignment.storeId ?? null, role: assignment.role, ...extra }
  });
}

/** Nudge the stores an assignment reaches (it may be revoked already, so not by user). */
function notifyAssignmentScope(assignment: Doc, reason: NotifyReason) {
  const organizationId = String(assignment.organizationId);
  if (assignment.workerInstallationId) {
    scheduleNotify({ organizationId, workerInstallationIds: [String(assignment.workerInstallationId)], reason });
  } else if (assignment.storeId) {
    scheduleNotify({ organizationId, storeId: String(assignment.storeId), reason });
  } else {
    scheduleNotify({ organizationId, reason });
  }
}

function newInvitation() {
  const secret = randomSecret(24);
  return { secret, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) };
}

async function emailInvitation(user: Doc, orgName: string, code: string, expiresAt: Date): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    await getEmailProvider().sendInvitation({
      to: String(user.email),
      recipientName: user.name ? String(user.name) : String(user.email).split("@")[0],
      organizationName: orgName,
      invitationCode: code,
      expiresAt
    });
    return true;
  } catch (error) {
    console.warn(`[users] invitation e-mail to ${String(user.appUserId)} failed: ${error instanceof Error ? error.message : "error"}`);
    return false;
  }
}

/** A user of this organization: the login exists and has an active assignment here. */
async function requireMember(organizationId: string, appUserId: string): Promise<Doc> {
  await connectDb();
  const [user, member] = await Promise.all([
    AppUserModel.findOne({ appUserId }).lean(),
    UserAssignmentModel.exists({ appUserId, organizationId, status: "active" })
  ]);
  if (!user || !member) throw notFound("User");
  return user as Doc;
}

async function memberView(organizationId: string, appUserId: string) {
  const [user, assignments, lookup] = await Promise.all([
    AppUserModel.findOne({ appUserId }).lean(),
    UserAssignmentModel.find({ appUserId, organizationId, status: "active" }).sort({ createdAt: 1 }).lean(),
    lookupFor(organizationId)
  ]);
  return userView(user as Doc, assignments as Doc[], lookup);
}

// ── Add ──────────────────────────────────────────────────────────────────────

export async function addUser(admin: InternalAdminActor, organizationId: string, body: AddUser) {
  const org = await requireOrganization(organizationId);
  const login = body.email ?? body.login;
  if (!login) throw new ControlPlaneError(400, "REQUEST_INVALID", "email: the login is required");
  await validateAssignments(organizationId, org, body.assignments);

  const existing = (await AppUserModel.findOne({ email: login }).lean()) as Doc | null;
  if (existing) {
    const appUserId = String(existing.appUserId);
    const results: Upserted[] = [];
    for (const input of body.assignments) results.push(await upsertAssignment(admin, organizationId, appUserId, input));
    const added = results.filter((result) => result.outcome !== "exists");
    if (added.length === 0) {
      throw new ControlPlaneError(409, "ASSIGNMENT_EXISTS", "That login already has this access", false, {
        user: await memberView(organizationId, appUserId)
      });
    }
    scheduleAppUserNotify(appUserId, "assignment.create");
    return {
      user: await memberView(organizationId, appUserId),
      existing: true,
      invitationCode: null,
      invitationExpiresAt: null,
      emailed: false,
      message: "This login already exists. Its password and details were not changed; access to this organization was added."
    };
  }

  const appUserId = publicId("appu");
  const now = new Date();
  const invitation = body.mode === "invite" ? newInvitation() : null;
  const created = await AppUserModel.create({
    appUserId,
    email: login,
    name: body.name ?? undefined,
    createdByAdminId: admin.adminId,
    ...(body.mode === "managed"
      ? {
          status: "active",
          loginType: "managed",
          passwordSetBy: "admin",
          passwordHash: await hashSecret(body.password),
          passwordChangedAt: now
        }
      : {
          status: "pending_enrollment",
          loginType: "email",
          enrollmentSecretHash: await hashSecret(invitation!.secret),
          enrollmentExpiresAt: invitation!.expiresAt
        })
  });
  await auditAdmin(admin, {
    organizationId,
    action: "user.create",
    targetType: "app_user",
    targetId: appUserId,
    metadata: { mode: body.mode, email: login }
  });
  for (const input of body.assignments) await upsertAssignment(admin, organizationId, appUserId, input);
  scheduleAppUserNotify(appUserId, "app_user.create");

  let invitationCode: string | null = null;
  let emailed = false;
  if (invitation) {
    invitationCode = `${appUserId}.${invitation.secret}`;
    emailed = await emailInvitation(created.toObject() as Doc, String(org.name), invitationCode, invitation.expiresAt);
  }
  return {
    user: await memberView(organizationId, appUserId),
    existing: false,
    invitationCode,
    invitationExpiresAt: invitation ? invitation.expiresAt.toISOString() : null,
    emailed,
    message:
      body.mode === "managed"
        ? "Login created. Only a StoreDesk admin can change its password."
        : emailed
          ? "Invitation e-mailed. The code is also shown here once."
          : "Give the user this invitation code; it is shown only once."
  };
}

// ── Change ───────────────────────────────────────────────────────────────────

/**
 * Name and status. A login is shared by every organization it belongs to, so
 * disabling it here disables it everywhere.
 */
export async function updateUser(
  admin: InternalAdminActor,
  organizationId: string,
  appUserId: string,
  body: z.output<typeof UserPatchSchema>
) {
  const user = await requireMember(organizationId, appUserId);
  const set: Doc = {};
  const unset: Doc = {};
  if (body.name !== undefined) {
    if (body.name) set.name = body.name;
    else unset.name = 1;
  }
  if (body.status === "disabled") set.status = "disabled";
  if (body.status === "active" && user.status !== "active") {
    // Asks whether a hash exists without loading it.
    const hasPassword = await AppUserModel.exists({ appUserId, passwordHash: { $exists: true, $nin: [null, ""] } });
    if (!hasPassword) {
      throw new ControlPlaneError(409, "USER_HAS_NO_PASSWORD", "This user has not set a password yet; re-send the invitation or set one");
    }
    set.status = "active";
  }
  await AppUserModel.updateOne(
    { appUserId },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) }
  );
  const statusChanged = set.status !== undefined && set.status !== user.status;
  await auditAdmin(admin, {
    organizationId,
    action: "user.update",
    targetType: "app_user",
    targetId: appUserId,
    metadata: { changed: Object.keys(body), ...(statusChanged ? { status: set.status, previousStatus: user.status } : {}) }
  });
  if (statusChanged || body.name !== undefined) {
    scheduleAppUserNotify(appUserId, set.status === "disabled" ? "app_user.disable" : "app_user.update");
  }
  return memberView(organizationId, appUserId);
}

/**
 * An admin sets a new password (audited). A pending user becomes active and
 * their invitation stops working; a disabled user stays disabled. The stores
 * pull the new hash and end that user's sessions.
 */
export async function setUserPassword(admin: InternalAdminActor, organizationId: string, appUserId: string, password: string) {
  const user = await requireMember(organizationId, appUserId);
  const now = new Date();
  await AppUserModel.updateOne(
    { appUserId },
    {
      $set: {
        passwordHash: await hashSecret(password),
        passwordChangedAt: now,
        passwordSetBy: "admin",
        ...(user.status === "pending_enrollment" ? { status: "active", enrollmentConsumedAt: now } : {})
      },
      $unset: { enrollmentSecretHash: 1 }
    }
  );
  await auditAdmin(admin, {
    organizationId,
    action: "user.password_set",
    targetType: "app_user",
    targetId: appUserId,
    metadata: { previousStatus: user.status }
  });
  scheduleAppUserNotify(appUserId, "app_user.password_set");
  return { ok: true as const };
}

/** A new invitation code for a user who has not set a password yet. The old code stops working. */
export async function reissueInvitation(admin: InternalAdminActor, organizationId: string, appUserId: string) {
  const user = await requireMember(organizationId, appUserId);
  if (user.status !== "pending_enrollment") {
    throw new ControlPlaneError(409, "USER_ALREADY_ENROLLED", "This user already has a password; set a new one instead");
  }
  const org = await requireOrganization(organizationId);
  const invitation = newInvitation();
  await AppUserModel.updateOne(
    { appUserId },
    {
      $set: { enrollmentSecretHash: await hashSecret(invitation.secret), enrollmentExpiresAt: invitation.expiresAt },
      $unset: { enrollmentConsumedAt: 1 }
    }
  );
  const invitationCode = `${appUserId}.${invitation.secret}`;
  const emailed = await emailInvitation(user, String(org.name), invitationCode, invitation.expiresAt);
  await auditAdmin(admin, {
    organizationId,
    action: "user.invite",
    targetType: "app_user",
    targetId: appUserId,
    metadata: { emailed }
  });
  return { invitationCode, expiresAt: invitation.expiresAt.toISOString(), emailed };
}

// ── Assignments ──────────────────────────────────────────────────────────────

export async function addAssignment(
  admin: InternalAdminActor,
  organizationId: string,
  appUserId: string,
  input: AssignmentInput
) {
  const org = await requireOrganization(organizationId);
  const user = await AppUserModel.findOne({ appUserId }).lean();
  if (!user) throw notFound("User");
  await validateAssignments(organizationId, org, [input]);
  const result = await upsertAssignment(admin, organizationId, appUserId, input);
  if (result.outcome === "exists") {
    throw new ControlPlaneError(409, "ASSIGNMENT_EXISTS", "The user already has access at that store");
  }
  notifyAssignmentScope(result.assignment, "assignment.create");
  return assignmentView(result.assignment, await lookupFor(organizationId, org));
}

async function requireAssignment(organizationId: string, appUserId: string, assignmentId: string): Promise<Doc> {
  await connectDb();
  const assignment = (await UserAssignmentModel.findOne({ assignmentId, appUserId, organizationId, status: "active" }).lean()) as Doc | null;
  if (!assignment) throw notFound("Assignment");
  return assignment;
}

/** Change the role, the store, or both. The id stays the same. */
export async function updateAssignment(
  admin: InternalAdminActor,
  organizationId: string,
  appUserId: string,
  assignmentId: string,
  body: z.output<typeof AssignmentPatchSchema>
) {
  const org = await requireOrganization(organizationId);
  const before = await requireAssignment(organizationId, appUserId, assignmentId);
  const target: AssignmentInput = {
    storeId: body.storeId === undefined ? (before.storeId ? String(before.storeId) : null) : body.storeId,
    role: body.role ?? String(before.role)
  };
  await validateAssignments(organizationId, org, [target]);
  const set: Doc = { role: target.role };
  const unset: Doc = {};
  const beforeStore = before.storeId ? String(before.storeId) : null;
  if (target.storeId !== beforeStore || before.workerInstallationId) {
    const clash = (await UserAssignmentModel.findOne({
      ...scopeFilter(appUserId, organizationId, target.storeId),
      assignmentId: { $ne: assignmentId }
    }).lean()) as Doc | null;
    if (clash?.status === "active") {
      throw new ControlPlaneError(409, "ASSIGNMENT_EXISTS", "The user already has access at that store");
    }
    // A revoked assignment at the target scope is only a tombstone; the audit
    // log keeps its history, and the unique index allows one row per scope.
    if (clash) await UserAssignmentModel.deleteOne({ assignmentId: clash.assignmentId });
    if (target.storeId) set.storeId = target.storeId;
    else unset.storeId = 1;
    unset.workerInstallationId = 1;
  }
  const after = (await UserAssignmentModel.findOneAndUpdate(
    { assignmentId },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after" }
  ).lean()) as Doc;
  await auditAssignment(admin, "assignment.update", after, { previousStoreId: beforeStore, previousRole: before.role });
  notifyAssignmentScope(before, "assignment.change");
  if (target.storeId !== beforeStore) notifyAssignmentScope(after, "assignment.change");
  return assignmentView(after, await lookupFor(organizationId, org));
}

export async function revokeAssignment(admin: InternalAdminActor, organizationId: string, appUserId: string, assignmentId: string) {
  const assignment = await requireAssignment(organizationId, appUserId, assignmentId);
  await UserAssignmentModel.updateOne({ assignmentId }, { $set: { status: "revoked", revokedAt: new Date() } });
  await auditAssignment(admin, "assignment.revoke", assignment);
  // By the assignment's scope: the user no longer has it, so notifying by user would miss it.
  notifyAssignmentScope(assignment, "assignment.revoke");
  return { ok: true as const };
}
