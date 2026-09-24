import { beforeEach, describe, expect, it } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  TenantStoreModel,
  UserAssignmentModel
} from "@/models/ControlPlane";
import { hashSecret, publicId, resetRateLimitsForTests } from "@/lib/control-plane-security";
import { migrateEmailIdentity, migrateStoreScopedAccess } from "@/lib/migrations";
import { reachableFor, requestPasswordReset, resetPassword, signIn, verifyEmail, requestEmailVerification } from "@/lib/accounts";
import { POST as signInRoute } from "@/app/api/v1/app-auth/sign-in/route";
import { POST as resetRoute } from "@/app/api/v1/app-auth/password-reset/route";

setupMemoryMongo();

const PASSWORD = "counter-top-8";
const later = () => new Date(Date.now() + 86_400_000 * 30);

async function organization(name: string, slug: string) {
  const organizationId = publicId("org");
  await OrganizationModel.create({ organizationId, name, slug, status: "active" });
  return organizationId;
}

async function store(organizationId: string, name: string, options: { unlicensed?: boolean } = {}) {
  const storeId = publicId("str");
  await TenantStoreModel.create({
    storeId,
    organizationId,
    name,
    status: "active",
    settings: { capabilities: { lottery: true }, timeZone: "America/New_York" }
  });
  if (!options.unlicensed) await licence(organizationId, storeId);
  return storeId;
}

async function licence(organizationId: string, storeId: string) {
  await LicenseModel.create({
    licenseId: publicId("lic"),
    organizationId,
    licenseNumber: `SD-STR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    scope: "store",
    storeId,
    plan: "standard",
    status: "active",
    startsAt: new Date(),
    entitlementExpiresAt: later(),
    coverageKey: `store:${storeId}`
  });
}

async function person(email: string, status = "active") {
  const appUserId = publicId("appu");
  await AppUserModel.create({ appUserId, email, name: "Dana Patel", status, passwordHash: await hashSecret(PASSWORD), createdByAdminId: publicId("adm") });
  return appUserId;
}

async function assign(appUserId: string, organizationId: string, storeId: string, role = "org_admin") {
  await UserAssignmentModel.create({
    assignmentId: publicId("asg"),
    appUserId,
    organizationId,
    storeId,
    role,
    status: "active",
    createdByAdminId: publicId("adm")
  });
}

const post = (body: unknown, caller = "203.0.113.9") =>
  new Request("http://localhost/api/v1/app-auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": caller },
    body: JSON.stringify(body)
  });

beforeEach(() => resetRateLimitsForTests());

describe("what one account can reach", () => {
  it("answers the stores a person has a row at, and only those", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const forty_two = await store(org, "Store 42");
    const seven = await store(org, "Store 7");
    await store(org, "Store 90");
    const dana = await person("dana@example.com");
    await assign(dana, org, forty_two);
    await assign(dana, org, seven);

    const reachable = await reachableFor(dana);
    expect(reachable.map((entry) => entry.name)).toEqual(["Store 42", "Store 7"]);
    expect(reachable.every((entry) => entry.licence.covered)).toBe(true);
    // One answer, not two: a store that sells lottery runs StoreDesk Lottery (D-24).
    expect(reachable[0]?.lottery).toEqual({ sells: true });
  });

  it("answers one store for a person assigned to only that one", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const one = await store(org, "Store 42");
    await store(org, "Store 7");
    const sam = await person("sam@example.com");
    await assign(sam, org, one, "clerk");

    const reachable = await reachableFor(sam);
    expect(reachable).toHaveLength(1);
    expect(reachable[0]?.storeId).toBe(one);
    expect(reachable[0]?.role.roleId).toBe("clerk");
  });

  it("carries a different role at each store, which is what a row per store is for", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const forty_two = await store(org, "Store 42");
    const seven = await store(org, "Store 7");
    const dana = await person("dana@example.com");
    await assign(dana, org, forty_two, "org_admin");
    await assign(dana, org, seven, "clerk");

    const byStore = new Map((await reachableFor(dana)).map((entry) => [entry.storeId, entry.role.roleId]));
    expect(byStore.get(forty_two)).toBe("org_admin");
    expect(byStore.get(seven)).toBe("clerk");
  });

  it("returns one flat list across two organizations, with no grouping above a store", async () => {
    const first = await organization("Patel Retail", "patel-retail");
    const second = await organization("Highway Stores", "highway");
    const highway = await store(second, "Highway 1");
    const fortyTwo = await store(first, "Store 42");

    const dana = await person("dana@example.com");
    await assign(dana, first, fortyTwo);
    await assign(dana, second, highway);

    const reachable = await reachableFor(dana);
    expect(reachable.map((entry) => entry.name)).toEqual(["Highway 1", "Store 42"]);
    expect(reachable[0]).not.toHaveProperty("stores");
    expect(reachable[0]).not.toHaveProperty("organizationId");
  });

  it("says a store is not covered rather than hiding it, so the reason can be read on screen", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const one = await store(org, "Store 42", { unlicensed: true });
    const dana = await person("dana@example.com");
    await assign(dana, org, one);

    const reachable = await reachableFor(dana);
    expect(reachable[0]?.licence).toEqual({ covered: false, status: null, expiresAt: null });
  });
});

describe("signing in with an email and nothing else", () => {
  it("answers the person and their stores, and says what to do next", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const one = await store(org, "Store 42");
    const dana = await person("dana@example.com");
    await assign(dana, org, one);

    const res = await signInRoute(post({ email: "Dana@Example.com ", password: PASSWORD }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("dana@example.com");
    expect(body.next).toBe("one_store");
    // A flat list of stores, with nothing above them (D-22).
    expect(body.stores[0].name).toBe("Store 42");
    expect(body).not.toHaveProperty("organizations");
  });

  it("asks for a store when there is more than one", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const one = await store(org, "Store 42");
    const two = await store(org, "Store 7");
    const dana = await person("dana@example.com");
    await assign(dana, org, one);
    await assign(dana, org, two);

    const body = await (await signInRoute(post({ email: "dana@example.com", password: PASSWORD }))).json();
    expect(body.next).toBe("pick_a_store");
  });

  it("never says whether the email exists", async () => {
    await person("dana@example.com");
    const wrongPassword = await signInRoute(post({ email: "dana@example.com", password: "not-the-password" }));
    const noSuchPerson = await signInRoute(post({ email: "nobody@example.com", password: PASSWORD }));

    expect(wrongPassword.status).toBe(401);
    expect(noSuchPerson.status).toBe(401);
    expect((await wrongPassword.json()).error.message).toBe((await noSuchPerson.json()).error.message);
  });

  it("returns no password hash to anybody, ever", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const one = await store(org, "Store 42");
    const dana = await person("dana@example.com");
    await assign(dana, org, one);

    const text = await (await signInRoute(post({ email: "dana@example.com", password: PASSWORD }))).text();
    expect(text).not.toContain("argon2");
    expect(text).not.toContain("passwordHash");
  });

  it("locks an email out after five wrong passwords, however many addresses they come from", async () => {
    await person("dana@example.com");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await signInRoute(post({ email: "dana@example.com", password: "wrong" }, `198.51.100.${attempt}`));
    }
    const locked = await signInRoute(post({ email: "dana@example.com", password: PASSWORD }, "198.51.100.99"));
    expect(locked.status).toBe(429);
    expect((await locked.json()).error.code).toBe("LOGIN_RATE_LIMITED");
  });

  it("turns an account that was switched off away, and says so plainly", async () => {
    await person("gone@example.com", "disabled");
    const res = await signInRoute(post({ email: "gone@example.com", password: PASSWORD }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ACCOUNT_DISABLED");
  });

  it("sends someone who has never set a password back to their invitation", async () => {
    await person("new@example.com", "pending_enrollment");
    const res = await signInRoute(post({ email: "new@example.com", password: PASSWORD }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("ACCOUNT_NOT_SET_UP");
  });

  it("signs in a person with no stores at all, and says there are none", async () => {
    await person("nostores@example.com");
    const body = await (await signInRoute(post({ email: "nostores@example.com", password: PASSWORD }))).json();
    expect(body.next).toBe("no_stores");
    expect(body.stores).toEqual([]);
  });
});

describe("the move to email as the identity", () => {
  it("takes an invitation that was used as proof of the address, and asks nobody twice", async () => {
    const dana = await person("dana@example.com");
    await AppUserModel.updateOne({ appUserId: dana }, { enrollmentConsumedAt: new Date("2026-05-01T00:00:00.000Z") });

    const first = await migrateEmailIdentity();
    expect(first).toEqual({ verified: 1, duplicates: 0 });
    expect(await requestEmailVerification(dana)).toBeNull();

    // Idempotent: a second instance running it changes nothing.
    expect(await migrateEmailIdentity()).toEqual({ verified: 0, duplicates: 0 });
  });

  it("leaves someone who never used an invitation to prove their address", async () => {
    const sam = await person("sam@example.com");
    await migrateEmailIdentity();
    const started = await requestEmailVerification(sam);
    expect(started).not.toBeNull();
  });
});

describe("the move to access at a store (D-22)", () => {
  /** The row the old model wrote for "every store": no storeId at all. */
  const orgWide = async (appUserId: string, organizationId: string, role = "org_admin") =>
    UserAssignmentModel.collection.insertOne({
      assignmentId: publicId("asg"),
      appUserId,
      organizationId,
      role,
      scopes: ["relay:request"],
      status: "active",
      createdByAdminId: publicId("adm")
    });

  it("expands one organization-wide row into a row per store, and keeps the reach", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const forty_two = await store(org, "Store 42");
    const seven = await store(org, "Store 7");
    const dana = await person("dana@example.com");
    await orgWide(dana, org);

    expect(await reachableFor(dana)).toEqual([]);
    expect(await migrateStoreScopedAccess()).toEqual({ expanded: 2, orphans: 0 });

    const reachable = await reachableFor(dana);
    expect(reachable.map((entry) => entry.storeId).sort()).toEqual([forty_two, seven].sort());
    expect(reachable.every((entry) => entry.role.roleId === "org_admin")).toBe(true);
    // The source row is gone, so a second instance running it changes nothing.
    expect(await UserAssignmentModel.countDocuments({})).toBe(2);
    expect(await migrateStoreScopedAccess()).toEqual({ expanded: 0, orphans: 0 });
  });

  it("leaves a store's own row alone, because it was always the more specific answer", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const forty_two = await store(org, "Store 42");
    const seven = await store(org, "Store 7");
    const dana = await person("dana@example.com");
    await assign(dana, org, forty_two, "clerk");
    await orgWide(dana, org, "org_admin");

    expect(await migrateStoreScopedAccess()).toEqual({ expanded: 1, orphans: 0 });
    const byStore = new Map((await reachableFor(dana)).map((entry) => [entry.storeId, entry.role.roleId]));
    expect(byStore.get(forty_two)).toBe("clerk");
    expect(byStore.get(seven)).toBe("org_admin");
  });

  it("deletes a row whose organization has no stores: it granted nothing then either", async () => {
    const org = await organization("Patel Retail", "patel-retail");
    const dana = await person("dana@example.com");
    await orgWide(dana, org);

    expect(await migrateStoreScopedAccess()).toEqual({ expanded: 0, orphans: 1 });
    expect(await UserAssignmentModel.countDocuments({})).toBe(0);
  });
});
describe("the password behind the email", () => {
  const resetPost = (body: unknown) =>
    new Request("http://localhost/api/v1/app-auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11" },
      body: JSON.stringify(body)
    });

  it("answers the same whether or not the address is one we know", async () => {
    await person("dana@example.com");
    const known = await resetRoute(resetPost({ email: "dana@example.com" }));
    const unknown = await resetRoute(resetPost({ email: "nobody@example.com" }));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.text()).toBe(await unknown.text());
  });

  it("changes the password, and the old one stops working at once", async () => {
    await person("dana@example.com");
    const started = await requestPasswordReset("dana@example.com");
    await resetPassword(started!.credential, "a-new-password-9");

    await expect(signIn({ email: "dana@example.com", password: PASSWORD })).rejects.toMatchObject({ code: "LOGIN_INVALID" });
    const after = await signIn({ email: "dana@example.com", password: "a-new-password-9" });
    expect(after.user.email).toBe("dana@example.com");
  });

  it("uses a reset link once", async () => {
    await person("dana@example.com");
    const started = await requestPasswordReset("dana@example.com");
    await resetPassword(started!.credential, "a-new-password-9");
    await expect(resetPassword(started!.credential, "another-password-9")).rejects.toMatchObject({ code: "RESET_INVALID" });
  });

  it("refuses a link that has run out", async () => {
    const dana = await person("dana@example.com");
    const started = await requestPasswordReset("dana@example.com");
    await AppUserModel.updateOne({ appUserId: dana }, { resetExpiresAt: new Date(Date.now() - 1_000) });
    await expect(resetPassword(started!.credential, "a-new-password-9")).rejects.toMatchObject({ code: "RESET_EXPIRED" });
  });

  it("will not bring a switched-off account back to life", async () => {
    await person("gone@example.com", "disabled");
    expect(await requestPasswordReset("gone@example.com")).toBeNull();
  });

  it("proves the address once, and a second proof changes nothing", async () => {
    const dana = await person("dana@example.com");
    const started = await requestEmailVerification(dana);
    const verified = await verifyEmail(started!.credential);
    expect(verified.emailVerified).toBe(true);
    expect(await requestEmailVerification(dana)).toBeNull();
  });
});

describe("proving an e-mail address", () => {
  /**
   * `requestEmailVerification` and `verifyEmail` existed from the day e-mail became the identity
   * (D-18) and nothing ever called them: no route, no page, so `emailVerifiedAt` was set for
   * nobody. These cover the half that was missing.
   */
  it("confirms an address from its code", async () => {
    const appUserId = await person(`v${Math.random().toString(36).slice(2)}@example.com`);
    const started = await requestEmailVerification(appUserId);
    expect(started?.credential).toBeTruthy();

    const account = await verifyEmail(started!.credential);
    expect(account.emailVerified).toBe(true);
  });

  it("answers the same on a second press, because a link gets clicked twice", async () => {
    const appUserId = await person(`v${Math.random().toString(36).slice(2)}@example.com`);
    const started = await requestEmailVerification(appUserId);
    await verifyEmail(started!.credential);
    // Idempotent: a person who pressed it on their phone and then their PC is not shown an error
    // about something that already worked.
    await expect(verifyEmail(started!.credential)).resolves.toMatchObject({ emailVerified: true });
  });

  it("refuses a code that is not ours", async () => {
    const appUserId = await person(`v${Math.random().toString(36).slice(2)}@example.com`);
    await requestEmailVerification(appUserId);
    await expect(verifyEmail(`${appUserId}.not-the-secret`)).rejects.toMatchObject({ code: "VERIFICATION_INVALID" });
  });

  it("has nothing to start for an address already confirmed", async () => {
    const appUserId = await person(`v${Math.random().toString(36).slice(2)}@example.com`);
    const started = await requestEmailVerification(appUserId);
    await verifyEmail(started!.credential);
    expect(await requestEmailVerification(appUserId)).toBeNull();
  });
});
