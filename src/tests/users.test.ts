import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as list, POST as add } from "@/app/api/v1/admin/organizations/[organizationId]/users/route";
import { PATCH as patchUser } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/route";
import { POST as setPassword } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/password/route";
import { POST as reinvite } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/invite/route";
import { POST as addAssignment } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/assignments/route";
import {
  DELETE as revokeAssignment,
  PATCH as patchAssignment
} from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/assignments/[assignmentId]/route";
import { POST as enroll } from "@/app/api/v1/app-auth/enroll/route";
import { createStore } from "@/lib/tenant-stores";
import { verifySecret } from "@/lib/control-plane-security";
import { scheduleAppUserNotify, scheduleNotify } from "@/lib/store-notify";
import { AppUserModel, AuditEventModel, UserAssignmentModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/**
 * Users (owner decision 5): managed logins and invitations in one path (P16),
 * an existing login never modified by an add (P1), admin password set,
 * re-invite, and assignments that must name a real role and store (P9).
 */

setupMemoryMongo();

let admin: TestAdmin;
let organizationId: string;
let storeId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  const seeded = await seedOrganization(admin);
  organizationId = seeded.organization.organizationId;
  storeId = seeded.store.storeId;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.SETUP_EMAIL_FROM;
});

function addCall(body: unknown, org = organizationId) {
  return call(add, request("POST", "/", { token: admin.token, body }), { organizationId: org });
}

const managed = (overrides: Record<string, unknown> = {}) => ({
  mode: "managed",
  email: "Rakesh@StoreDesk.com",
  name: "Rakesh",
  password: "first-password",
  assignments: [{ storeId: null, role: "store_manager" }],
  ...overrides
});

async function hashOf(email: string) {
  return String((await AppUserModel.findOne({ email }).select("+passwordHash").lean())?.passwordHash ?? "");
}

describe("POST …/users", () => {
  it("creates a managed login: active, admin-set password, one id prefix each, audited and notified", async () => {
    const res = await addCall(managed());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ existing: false, invitationCode: null, emailed: false });
    expect(res.body.user).toMatchObject({
      email: "rakesh@storedesk.com",
      name: "Rakesh",
      status: "active",
      loginType: "managed",
      passwordSetBy: "admin",
      invitation: null
    });
    expect(res.body.user.appUserId).toMatch(/^appu_[a-f0-9]{32}$/);
    expect(res.body.user.assignments).toEqual([
      expect.objectContaining({ storeId: null, role: "store_manager", roleName: "Store Manager", status: "active" })
    ]);
    expect(res.body.user.assignments[0].assignmentId).toMatch(/^assign_[a-f0-9]{32}$/);
    expect(await verifySecret(await hashOf("rakesh@storedesk.com"), "first-password")).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("argon2");
    expect(await lastAudit("user.create")).toMatchObject({ targetId: res.body.user.appUserId, actorId: admin.adminId });
    expect(await lastAudit("assignment.create")).toBeTruthy();
    expect(JSON.stringify(await AuditEventModel.find({}).lean())).not.toContain("first-password");
    expect(scheduleAppUserNotify).toHaveBeenCalledWith(res.body.user.appUserId, "app_user.create");
  });

  it("invites by e-mail: pending, a one-time code that enrolls at /enroll", async () => {
    const res = await addCall({ mode: "invite", email: "sam@example.invalid", assignments: [{ storeId, role: "cashier" }] });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ status: "pending_enrollment", loginType: "email", passwordSetBy: null });
    expect(res.body.user.invitation.expired).toBe(false);
    expect(res.body.invitationCode).toMatch(/^appu_[a-f0-9]{32}\./);
    expect(res.body.emailed).toBe(false);
    const enrolled = await call(
      enroll,
      request("POST", "/", { body: { enrollmentCredential: res.body.invitationCode, password: "sams-password", deviceName: "web", audience: "mobile" } })
    );
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.assignments[0]).toMatchObject({ storeId, role: "cashier", storeName: "Store 42" });
    const user = await AppUserModel.findOne({ email: "sam@example.invalid" }).lean();
    expect(user).toMatchObject({ status: "active", passwordSetBy: "user" });
  });

  it("e-mails the invitation when e-mail is configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.SETUP_EMAIL_FROM = "StoreDesk <hello@example.invalid>";
    const sent: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    }));
    const res = await addCall({ mode: "invite", email: "sam@example.invalid", assignments: [{ storeId, role: "cashier" }] });
    expect(res.body.emailed).toBe(true);
    expect(sent[0].to).toEqual(["sam@example.invalid"]);
    expect(String(sent[0].text)).toContain(res.body.invitationCode);
  });

  it("never modifies an existing login: its password stays, only the access is added (P1)", async () => {
    const other = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
    await addCall(managed({ name: "Original" }), other.organization.organizationId);
    const before = await hashOf("rakesh@storedesk.com");

    const res = await addCall(managed({ name: "Changed", password: "attacker-password", assignments: [{ storeId, role: "cashier" }] }));
    expect(res.status).toBe(200);
    expect(res.body.existing).toBe(true);
    expect(res.body.message).toContain("not changed");
    expect(res.body.user.name).toBe("Original");
    expect(res.body.user.assignments).toEqual([expect.objectContaining({ storeId, role: "cashier" })]);
    expect(await hashOf("rakesh@storedesk.com")).toBe(before);
    expect(await verifySecret(before, "attacker-password")).toBe(false);
    expect(await AuditEventModel.countDocuments({ action: "user.create" })).toBe(1);

    const again = await addCall(managed({ assignments: [{ storeId, role: "cashier" }] }));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ASSIGNMENT_EXISTS");
  });

  it.each([
    ["a short password", managed({ password: "short" })],
    ["no password for a managed login", managed({ password: undefined })],
    ["a role the organization doesn't have", managed({ assignments: [{ storeId: null, role: "store_operator" }] })],
    ["a store of another organization", managed({ assignments: [{ storeId: "store_elsewhere", role: "cashier" }] })],
    ["the same store twice", managed({ assignments: [{ storeId, role: "cashier" }, { storeId, role: "viewer" }] })],
    ["no assignments", managed({ assignments: [] })],
    ["a login that is not e-mail-shaped", managed({ email: "rakesh" })],
    ["no mode", { email: "a@example.invalid", assignments: [{ storeId: null, role: "viewer" }] }]
  ])("answers 400 for %s", async (_label, body) => {
    const res = await addCall(body);
    expect(res.status).toBe(400);
    expect(await AppUserModel.countDocuments()).toBe(0);
  });

  it("lists the organization's users with their assignments; 401 without a session", async () => {
    await addCall(managed());
    const res = await call(list, request("GET", "/", { token: admin.token }), { organizationId });
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].assignments[0]).toMatchObject({ role: "store_manager", storeId: null });
    expect((await call(list, request("GET", "/"), { organizationId })).status).toBe(401);
    expect((await addCall({ ...managed() }, "org_nope")).status).toBe(404);
  });
});

describe("PATCH, password and invite on …/users/{appUserId}", () => {
  it("disables a login, audits and notifies its stores; 409 activating one with no password", async () => {
    const { body } = await addCall(managed());
    const params = { organizationId, appUserId: body.user.appUserId };
    const res = await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "disabled", name: "R." } }), params);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ status: "disabled", name: "R." });
    expect((await lastAudit("user.update"))?.metadata).toMatchObject({ status: "disabled", previousStatus: "active" });
    expect(scheduleAppUserNotify).toHaveBeenCalledWith(body.user.appUserId, "app_user.disable");
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "active" } }), params)).body.user.status).toBe("active");

    const invited = await addCall({ mode: "invite", email: "p@example.invalid", assignments: [{ storeId, role: "cashier" }] });
    const noPassword = await call(
      patchUser,
      request("PATCH", "/", { token: admin.token, body: { status: "active" } }),
      { organizationId, appUserId: invited.body.user.appUserId }
    );
    expect(noPassword.status).toBe(409);
    expect(noPassword.body.error.code).toBe("USER_HAS_NO_PASSWORD");
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "pending_enrollment" } }), params)).status).toBe(400);
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { name: "x" } }), { organizationId, appUserId: "appu_nope" })).status).toBe(404);
  });

  it("sets a password: audited without it, activates a pending user, notifies the stores", async () => {
    const invited = await addCall({ mode: "invite", email: "p@example.invalid", assignments: [{ storeId, role: "cashier" }] });
    const params = { organizationId, appUserId: invited.body.user.appUserId };
    const res = await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "admin-chosen" } }), params);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const user = await AppUserModel.findOne({ appUserId: params.appUserId }).lean();
    expect(user).toMatchObject({ status: "active", passwordSetBy: "admin" });
    expect(await verifySecret(await hashOf("p@example.invalid"), "admin-chosen")).toBe(true);
    const audit = await lastAudit("user.password_set");
    expect(audit).toMatchObject({ targetId: params.appUserId });
    expect(JSON.stringify(audit)).not.toContain("admin-chosen");
    expect(scheduleAppUserNotify).toHaveBeenCalledWith(params.appUserId, "app_user.password_set");
    // The invitation stops working.
    const enrolled = await call(
      enroll,
      request("POST", "/", { body: { enrollmentCredential: invited.body.invitationCode, password: "late-password", deviceName: "web", audience: "mobile" } })
    );
    expect(enrolled.status).toBe(401);
    expect((await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "short" } }), params)).status).toBe(400);
  });

  it("re-issues an invitation; the old code stops working; 409 for an enrolled user", async () => {
    const invited = await addCall({ mode: "invite", email: "p@example.invalid", assignments: [{ storeId, role: "cashier" }] });
    const params = { organizationId, appUserId: invited.body.user.appUserId };
    const res = await call(reinvite, request("POST", "/", { token: admin.token }), params);
    expect(res.status).toBe(200);
    expect(res.body.invitationCode).not.toBe(invited.body.invitationCode);
    expect(res.body).toMatchObject({ emailed: false });
    expect(await lastAudit("user.invite")).toBeTruthy();
    const old = await call(enroll, request("POST", "/", { body: { enrollmentCredential: invited.body.invitationCode, password: "p-password", deviceName: "w", audience: "mobile" } }));
    expect(old.status).toBe(401);

    const active = await addCall(managed());
    const enrolled = await call(reinvite, request("POST", "/", { token: admin.token }), { organizationId, appUserId: active.body.user.appUserId });
    expect(enrolled.status).toBe(409);
    expect(enrolled.body.error.code).toBe("USER_ALREADY_ENROLLED");
  });
});

describe("…/users/{appUserId}/assignments", () => {
  it("adds, changes and revokes access, notifying the stores each reaches", async () => {
    const { body } = await addCall(managed());
    const appUserId = body.user.appUserId;
    const { store: second } = await createStore(admin, organizationId, { name: "Store 17" });

    const added = await call(addAssignment, request("POST", "/", { token: admin.token, body: { storeId, role: "cashier" } }), { organizationId, appUserId });
    expect(added.status).toBe(201);
    expect(added.body.assignment).toMatchObject({ storeId, role: "cashier", storeName: "Store 42" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId, reason: "assignment.create" });
    const dup = await call(addAssignment, request("POST", "/", { token: admin.token, body: { storeId, role: "viewer" } }), { organizationId, appUserId });
    expect(dup.status).toBe(409);

    const assignmentId = added.body.assignment.assignmentId;
    const moved = await call(
      patchAssignment,
      request("PATCH", "/", { token: admin.token, body: { storeId: second.storeId, role: "viewer" } }),
      { organizationId, appUserId, assignmentId }
    );
    expect(moved.status).toBe(200);
    expect(moved.body.assignment).toMatchObject({ assignmentId, storeId: second.storeId, role: "viewer" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId, reason: "assignment.change" });
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId: second.storeId, reason: "assignment.change" });
    expect(await lastAudit("assignment.update")).toBeTruthy();
    const badRole = await call(patchAssignment, request("PATCH", "/", { token: admin.token, body: { role: "boss" } }), { organizationId, appUserId, assignmentId });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe("ROLE_UNKNOWN");

    const revoked = await call(revokeAssignment, request("DELETE", "/", { token: admin.token }), { organizationId, appUserId, assignmentId });
    expect(revoked.status).toBe(200);
    expect((await UserAssignmentModel.findOne({ assignmentId }).lean())?.status).toBe("revoked");
    expect(scheduleNotify).toHaveBeenCalledWith({ organizationId, storeId: second.storeId, reason: "assignment.revoke" });
    expect(await lastAudit("assignment.revoke")).toMatchObject({ targetId: assignmentId });
    expect((await call(revokeAssignment, request("DELETE", "/", { token: admin.token }), { organizationId, appUserId, assignmentId })).status).toBe(404);

    // Re-adding the same scope reactivates the revoked row.
    const back = await call(addAssignment, request("POST", "/", { token: admin.token, body: { storeId: second.storeId, role: "cashier" } }), { organizationId, appUserId });
    expect(back.status).toBe(201);
    expect(back.body.assignment.assignmentId).toBe(assignmentId);
  });
});
