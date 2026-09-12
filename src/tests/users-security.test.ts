import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { call, createAdmin, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as listUsersRoute, POST as addUserRoute } from "@/app/api/v1/admin/organizations/[organizationId]/users/route";
import { PATCH as patchUser } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/route";
import { POST as setPassword } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/password/route";
import { POST as reinvite } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/invite/route";
import { DELETE as revokeAssignment } from "@/app/api/v1/admin/organizations/[organizationId]/users/[appUserId]/assignments/[assignmentId]/route";
import { POST as enroll } from "@/app/api/v1/app-auth/enroll/route";
import { AppUserModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => ({ tunnelDeleted: true, dnsDeleted: true })),
  rotateCloudflareTunnel: vi.fn()
}));

/**
 * A login can belong to several organizations. Only the one that created it
 * may change its password, status or invitation, and only while no other
 * organization has it (409 LOGIN_SHARED). A disabled invitee cannot come back
 * through an old invitation code.
 */

setupMemoryMongo();

let admin: TestAdmin;
let orgA: string;
let orgB: string;
let storeA: string;
let storeB: string;

beforeEach(async () => {
  vi.clearAllMocks();
  admin = await createAdmin();
  const a = await seedOrganization(admin);
  const b = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
  [orgA, orgB, storeA, storeB] = [a.organization.organizationId, b.organization.organizationId, a.store.storeId, b.store.storeId];
});

const LOGIN = "shared@example.invalid";

async function add(organizationId: string, storeId: string, body: Record<string, unknown> = {}) {
  return call(
    addUserRoute,
    request("POST", "/", {
      token: admin.token,
      body: { mode: "managed", email: LOGIN, password: "first-password", assignments: [{ storeId, role: "cashier" }], ...body }
    }),
    { organizationId }
  );
}

const asOrg = (organizationId: string, appUserId: string) => ({ organizationId, appUserId });

describe("a login shared across organizations (LOGIN_SHARED)", () => {
  it("records the creating organization and refuses password and status changes from another one", async () => {
    const created = await add(orgA, storeA);
    const appUserId = created.body.user.appUserId;
    expect((await AppUserModel.findOne({ appUserId }).lean())?.createdInOrganizationId).toBe(orgA);
    await add(orgB, storeB);

    const fromB = await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "takeover-pass" } }), asOrg(orgB, appUserId));
    expect(fromB.status).toBe(409);
    expect(fromB.body.error.code).toBe("LOGIN_SHARED");
    expect(fromB.body.error.message).toContain("Example Retail");
    expect(fromB.body.organizations).toEqual([expect.objectContaining({ organizationId: orgA, name: "Example Retail" })]);
    const disableFromB = await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "disabled" } }), asOrg(orgB, appUserId));
    expect(disableFromB.status).toBe(409);
    // The name is not the login's credential; it may be edited anywhere.
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { name: "Sam" } }), asOrg(orgB, appUserId))).status).toBe(200);

    // Not even the creating organization, while another one still has the login.
    const fromA = await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "new-password" } }), asOrg(orgA, appUserId));
    expect(fromA.status).toBe(409);
    expect(fromA.body.organizations).toEqual([expect.objectContaining({ organizationId: orgB, name: "Other Retail" })]);
    expect((await AppUserModel.findOne({ appUserId }).lean())?.status).toBe("active");

    const listed = await call(listUsersRoute, request("GET", "/", { token: admin.token }), { organizationId: orgB });
    expect(listed.body.users[0]).toMatchObject({
      sharedWith: [expect.objectContaining({ organizationId: orgA })],
      loginChangeBlocked: expect.stringContaining("created by Example Retail")
    });

    // Once only the creating organization has it, it may change it again.
    const assignmentB = listed.body.users[0].assignments[0].assignmentId;
    await call(revokeAssignment, request("DELETE", "/", { token: admin.token }), { ...asOrg(orgB, appUserId), assignmentId: assignmentB });
    expect((await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "new-password" } }), asOrg(orgA, appUserId))).status).toBe(200);
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "disabled" } }), asOrg(orgA, appUserId))).status).toBe(200);
    const own = await call(listUsersRoute, request("GET", "/", { token: admin.token }), { organizationId: orgA });
    expect(own.body.users[0]).toMatchObject({ sharedWith: [], loginChangeBlocked: null });
  });

  it("refuses a re-issued invitation from another organization", async () => {
    const invited = await add(orgA, storeA, { mode: "invite", password: undefined });
    await add(orgB, storeB);
    const res = await call(reinvite, request("POST", "/", { token: admin.token }), asOrg(orgB, invited.body.user.appUserId));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LOGIN_SHARED");
  });

  it("lets the only organization of a login from an older build change it", async () => {
    const created = await add(orgB, storeB);
    await AppUserModel.updateOne({ appUserId: created.body.user.appUserId }, { $unset: { createdInOrganizationId: 1 } });
    const res = await call(setPassword, request("POST", "/", { token: admin.token, body: { password: "new-password" } }), asOrg(orgB, created.body.user.appUserId));
    expect(res.status).toBe(200);
  });
});

describe("a disabled invitee at /enroll", () => {
  const redeemInvitation = (code: string) =>
    call(enroll, request("POST", "/", { body: { enrollmentCredential: code, password: "my-password", deviceName: "web", audience: "mobile" } }));

  it("disabling withdraws the invitation: the old code no longer works", async () => {
    const invited = await add(orgA, storeA, { mode: "invite", password: undefined });
    const appUserId = invited.body.user.appUserId;
    expect((await call(patchUser, request("PATCH", "/", { token: admin.token, body: { status: "disabled" } }), asOrg(orgA, appUserId))).status).toBe(200);
    const user = await AppUserModel.findOne({ appUserId }).select("+enrollmentSecretHash").lean();
    expect(user?.enrollmentSecretHash).toBeUndefined();
    expect(user?.enrollmentExpiresAt).toBeUndefined();
    const res = await redeemInvitation(invited.body.invitationCode);
    expect(res.status).toBe(401);
    expect((await AppUserModel.findOne({ appUserId }).lean())?.status).toBe("disabled");
  });

  it("enrollment accepts only a pending user, even if a disabled one still had a code", async () => {
    const invited = await add(orgA, storeA, { mode: "invite", password: undefined });
    await AppUserModel.updateOne({ appUserId: invited.body.user.appUserId }, { $set: { status: "disabled" } });
    const res = await redeemInvitation(invited.body.invitationCode);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ENROLLMENT_INVALID");
    expect((await AppUserModel.findOne({ appUserId: invited.body.user.appUserId }).lean())?.status).toBe("disabled");
  });
});
