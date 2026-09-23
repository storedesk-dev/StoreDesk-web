import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  accessSyncVersion,
  buildAccessSyncBody,
  pickAssignmentsForInstallation
} from "@/lib/access-sync";
import { CONTRACT_VERSION, safeJson } from "@/lib/control-plane-security";
import { normalizeRoles } from "@/lib/roles";

/**
 * The access pull is the one response that carries password hashes. These pin
 * its exact shape, who gets a hash, the content version, and that the
 * scrubber keeps stripping `passwordHash` everywhere else.
 */

const HASH = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA";

const organization = {
  organizationId: "org_1",
  slug: "example-retail",
  name: "Example Retail",
  status: "active",
  createdAt: new Date("2030-01-01T00:00:00Z")
};
const store = {
  storeId: "store_1",
  name: "Store 42",
  storeNumber: "42",
  status: "active",
  tunnelUrl: "https://store-42.example.invalid",
  cloudflareToken: "MUST_NOT_LEAK"
};
/** The store's covering license. */
const subscription = {
  licenseId: "lic_1",
  licenseNumber: "SD-ORG-7K3Q92",
  scope: "organization",
  status: "active",
  entitlementExpiresAt: new Date("2030-02-01T00:00:00Z"),
  offlineGraceDays: 7
};

function user(appUserId: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    appUserId,
    email: `${appUserId}@Example.invalid`,
    name: null,
    status,
    passwordHash: HASH,
    enrollmentSecretHash: "MUST_NOT_LEAK",
    ...extra
  };
}

function assignment(appUserId: string, extra: Record<string, unknown> = {}) {
  return {
    assignmentId: `asg_${appUserId}`,
    appUserId,
    organizationId: "org_1",
    storeId: "store_1",
    workerInstallationId: "winst_1",
    role: "org_admin",
    scopes: ["relay:request"],
    status: "active",
    ...extra
  };
}

function build(overrides: Partial<Parameters<typeof buildAccessSyncBody>[0]> = {}) {
  return buildAccessSyncBody({
    organization,
    store,
    subscription,
    roles: normalizeRoles([], "2030-01-01T00:00:00.000Z"),
    users: [
      { user: user("appu_b", "active", { passwordChangedAt: new Date("2030-01-05T00:00:00Z") }), assignment: assignment("appu_b") },
      { user: user("appu_a", "pending_enrollment"), assignment: assignment("appu_a") },
      { user: user("appu_c", "disabled"), assignment: assignment("appu_c") }
    ],
    generatedAt: new Date("2030-01-10T00:00:00Z"),
    ...overrides
  });
}

describe("buildAccessSyncBody", () => {
  it("has exactly the documented fields", () => {
    const body = build();
    expect(Object.keys(body).sort()).toEqual(
      ["contractVersion", "generatedAt", "organization", "roles", "store", "subscription", "users", "version"].sort()
    );
    expect(body.contractVersion).toBe(CONTRACT_VERSION);
    expect(body.organization).toEqual({
      organizationId: "org_1",
      slug: "example-retail",
      name: "Example Retail",
      status: "active"
    });
    expect(body.store).toEqual({
      storeId: "store_1",
      name: "Store 42",
      storeNumber: "42",
      status: "active",
      tunnelUrl: "https://store-42.example.invalid",
      // A store record from an older build: every setting reads as its default, capabilities not answered.
      capabilities: { lottery: null, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null },
      settings: {
        storedesk: { appEnabled: true },
        lottery: { setupMode: null, appEnabled: false },
        integrations: {
          googleSheets: { enabled: false, spreadsheetUrl: null, spreadsheetId: null, sheetName: null, headerRow: 1 },
          gtc: { status: "coming_soon" }
        },
        timeZone: null
      },
      settingsVersion: 1
    });
    expect(body.subscription).toEqual({
      status: "active",
      entitlementExpiresAt: "2030-02-01T00:00:00.000Z",
      offlineGraceDays: 7,
      licenseNumber: "SD-ORG-7K3Q92",
      scope: "organization"
    });
    expect(body.roles[0]).toMatchObject({ roleId: "org_admin", version: 1, updatedAt: "2030-01-01T00:00:00.000Z" });
    expect(body.version).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives a password hash to active users only, and sorts users", () => {
    const body = build();
    expect(body.users.map((u) => u.appUserId)).toEqual(["appu_a", "appu_b", "appu_c"]);
    const [pending, active, disabled] = body.users;

    expect(active).toEqual({
      appUserId: "appu_b",
      email: "appu_b@example.invalid",
      name: null,
      status: "active",
      passwordHash: HASH,
      passwordChangedAt: "2030-01-05T00:00:00.000Z",
      assignment: { assignmentId: "asg_appu_b", role: "org_admin", scopes: ["relay:request"] }
    });
    // Listed without a hash, so the store can say "set your password first".
    expect(pending).not.toHaveProperty("passwordHash");
    expect(pending.passwordChangedAt).toBeNull();
    expect(disabled).not.toHaveProperty("passwordHash");
    expect(disabled.status).toBe("disabled");
  });

  it("carries no other secret anywhere", () => {
    const text = JSON.stringify(build());
    expect(text).not.toContain("MUST_NOT_LEAK");
    // Only the one active user's hash, once.
    expect(text.split(HASH).length - 1).toBe(1);
    const { users, ...rest } = build();
    expect(users.length).toBe(3);
    expect(JSON.stringify(rest)).not.toContain("passwordHash");
  });

  it("answers status none, with no license number, when there is no covering license", () => {
    expect(build({ subscription: null }).subscription).toEqual({
      status: "none",
      entitlementExpiresAt: null,
      offlineGraceDays: 7,
      licenseNumber: null,
      scope: null
    });
  });
});

describe("access sync version", () => {
  it("ignores generatedAt and input key order", () => {
    const first = build();
    const later = build({ generatedAt: new Date("2031-01-01T00:00:00Z") });
    const reordered = build({ organization: { status: "active", name: "Example Retail", slug: "example-retail", organizationId: "org_1", createdAt: organization.createdAt } });
    expect(later.version).toBe(first.version);
    expect(reordered.version).toBe(first.version);
  });

  it("is the sha256 of the body without version and generatedAt", () => {
    const body = build();
    const { version, generatedAt, ...content } = body;
    expect(generatedAt).toBe("2030-01-10T00:00:00.000Z");
    expect(accessSyncVersion(content)).toBe(version);
  });

  it("changes when a password or a role changes", () => {
    const base = build().version;
    const newPassword = build({
      users: [{ user: user("appu_b", "active", { passwordHash: `${HASH}x` }), assignment: assignment("appu_b") }]
    });
    const samePassword = build({
      users: [{ user: user("appu_b", "active"), assignment: assignment("appu_b") }]
    });
    expect(newPassword.version).not.toBe(samePassword.version);
    const bumped = normalizeRoles([], "2030-01-01T00:00:00.000Z");
    bumped[0] = { ...bumped[0], version: 2 };
    expect(build({ roles: bumped }).version).not.toBe(base);
  });

  it("changes when the store's features or settings change", () => {
    const base = build().version;
    const withFuel = build({ store: { ...store, settings: { capabilities: { fuel: true } }, settingsVersion: 2 } });
    expect(withFuel.store.capabilities).toEqual({ lottery: null, coam: null, fuel: true, ebt: null, moneyOrder: null, prepaidGift: null });
    expect(withFuel.store.settingsVersion).toBe(2);
    expect(withFuel.version).not.toBe(base);
    const withZone = build({ store: { ...store, settings: { timeZone: "America/Chicago" } } });
    expect(withZone.store.settings.timeZone).toBe("America/Chicago");
    expect(withZone.version).not.toBe(base);
  });
});

describe("pickAssignmentsForInstallation", () => {
  const target = { organizationId: "org_1", storeId: "store_1", workerInstallationId: "winst_1" };

  it("takes the most specific assignment and ignores other stores", () => {
    const picked = pickAssignmentsForInstallation(
      [
        assignment("u1", { assignmentId: "z_org", storeId: undefined, workerInstallationId: undefined, role: "org_viewer" }),
        assignment("u1", { assignmentId: "y_store", workerInstallationId: undefined, role: "store_manager" }),
        assignment("u1", { assignmentId: "x_inst", role: "cashier" }),
        assignment("u2", { workerInstallationId: undefined, storeId: undefined, role: "org_admin" }),
        assignment("u3", { storeId: "store_2", workerInstallationId: undefined }),
        assignment("u4", { workerInstallationId: "winst_other" }),
        assignment("u5", { organizationId: "org_2", workerInstallationId: undefined, storeId: undefined }),
        assignment("u6", { status: "revoked" })
      ],
      target
    );
    expect([...picked.keys()].sort()).toEqual(["u1", "u2"]);
    expect(picked.get("u1")?.role).toBe("cashier");
    // Organization-wide ("All Stores") reaches every store of the organization.
    expect(picked.get("u2")?.role).toBe("org_admin");
  });

  it("breaks a tie by assignmentId so the pick is stable", () => {
    const picked = pickAssignmentsForInstallation(
      [assignment("u1", { assignmentId: "b", role: "second" }), assignment("u1", { assignmentId: "a", role: "first" })],
      target
    );
    expect(picked.get("u1")?.role).toBe("first");
  });
});

describe("passwordHash stays out of every other response", () => {
  it("is still stripped by safeJson at any depth", () => {
    const scrubbed = safeJson({
      appUser: { appUserId: "appu_1", passwordHash: HASH, nested: [{ passwordHash: HASH }] },
      users: [{ passwordHash: HASH, email: "a@example.invalid" }]
    });
    expect(JSON.stringify(scrubbed)).not.toContain(HASH);
    expect(scrubbed.users[0].email).toBe("a@example.invalid");
  });

  it("is selected explicitly only where it is needed", () => {
    // `+passwordHash` defeats `select: false`. Outside these files a new use is
    // a new way to leak it: the access sync (which returns it on purpose), the
    // legacy login and enrollment (which only verify or set it), and the
    // internal admin login (a different model).
    // App sign-in and password reset (lib/accounts.ts) join them: they verify
    // or set the hash and return neither — accounts.test.ts reads the sign-in
    // response and asserts the hash is not anywhere in it.
    //
    // The lottery projection (lib/supabase-projection.ts) is the second place
    // a hash is sent on purpose, and for the same reason as the access sync: a
    // lottery PC checks passwords itself, so a store keeps working with the
    // line down. It lands in app.app_user_secret, which supabase/tests/rls.sql
    // proves only a device can read — never a person, not even their own.
    const allowed = new Set([
      "lib/access-sync.ts",
      "lib/control-plane.ts",
      "lib/admin-auth.ts",
      "lib/accounts.ts",
      "lib/supabase-projection.ts"
    ]);
    const root = path.resolve(__dirname, "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== "tests") walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js)$/.test(name)) continue;
        const rel = path.relative(root, full).split(path.sep).join("/");
        if (readFileSync(full, "utf8").includes("+passwordHash") && !allowed.has(rel)) offenders.push(rel);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
