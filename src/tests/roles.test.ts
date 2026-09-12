import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORG_ROLES,
  EdgeRoleUpdateSchema,
  RoleListSchema,
  applyRoleVersions,
  normalizeRoles,
  roleChangeReason
} from "@/lib/roles";
import { canonicalJson } from "@/lib/control-plane-security";

const CREATED = "2030-01-01T00:00:00.000Z";

const cashier = {
  roleId: "cashier",
  roleName: "Cashier",
  accessKeys: {
    electron: { pages: [{ key: "pos", enabled: true, featureFlags: { enableRefunds: false } }] },
    mobile: { pages: [{ key: "mobilePos", enabled: true, featureFlags: {} }] }
  }
};

describe("normalizeRoles", () => {
  it("gives an organization without stored roles the defaults at version 1", () => {
    const roles = normalizeRoles([], CREATED);
    expect(roles.map((role) => role.roleId)).toEqual(DEFAULT_ORG_ROLES.map((role) => role.roleId));
    expect(roles.every((role) => role.version === 1 && role.updatedAt === CREATED)).toBe(true);
    expect(normalizeRoles(undefined, CREATED)).toEqual(roles);
  });

  it("reads a missing or unusable version as 1 and keeps a stored one", () => {
    const roles = normalizeRoles(
      [
        { ...cashier, roleId: "a" },
        { ...cashier, roleId: "b", version: 0 },
        { ...cashier, roleId: "c", version: "3" },
        { ...cashier, roleId: "d", version: 1.5 },
        { ...cashier, roleId: "e", version: 4, updatedAt: new Date("2031-05-05T05:05:05Z") }
      ],
      CREATED
    );
    expect(roles.map((role) => role.version)).toEqual([1, 1, 1, 1, 4]);
    expect(roles[4].updatedAt).toBe("2031-05-05T05:05:05.000Z");
    expect(roles[0].updatedAt).toBe(CREATED);
  });

  it("reduces pages to key, enabled and boolean flags, always with both apps", () => {
    const [role] = normalizeRoles(
      [
        {
          roleId: "odd",
          accessKeys: {
            electron: {
              pages: [
                { key: "pos", enabled: "yes", featureFlags: { a: true, b: "true" }, extra: 1 },
                { key: 7, enabled: true },
                null
              ]
            }
          }
        }
      ],
      CREATED
    );
    expect(role.roleName).toBe("odd");
    expect(role.accessKeys).toEqual({
      electron: { pages: [{ key: "pos", enabled: false, featureFlags: { a: true } }] },
      mobile: { pages: [] }
    });
  });
});

describe("applyRoleVersions", () => {
  const previous = normalizeRoles([{ ...cashier, version: 3, updatedAt: CREATED }], CREATED);
  const now = new Date("2030-06-01T12:00:00Z");

  it("keeps an unchanged role's version and updatedAt", () => {
    const result = applyRoleVersions(previous, [cashier], now);
    expect(result.roles[0]).toEqual(previous[0]);
    expect(result.changed).toBe(false);
  });

  it("bumps a changed role, starts a new one at 1, and lists a deleted one", () => {
    const edited = { ...cashier, roleName: "Front cashier" };
    const added = { ...cashier, roleId: "manager", roleName: "Manager" };
    const result = applyRoleVersions(previous, [edited, added], now);
    expect(result.roles[0]).toMatchObject({ roleId: "cashier", version: 4, updatedAt: now.toISOString() });
    expect(result.roles[1]).toMatchObject({ roleId: "manager", version: 1 });
    expect(result.updated).toEqual(["cashier"]);
    expect(result.created).toEqual(["manager"]);

    const removed = applyRoleVersions(previous, [], now);
    expect(removed.deleted).toEqual(["cashier"]);
    expect(roleChangeReason(removed)).toBe("role.delete");
    expect(roleChangeReason({ created: ["x"], updated: [], deleted: [] })).toBe("role.create");
    expect(roleChangeReason(result)).toBe("role.update");
  });

  it("ignores a version the client sends", () => {
    const parsed = RoleListSchema.parse([{ ...cashier, version: 99, updatedAt: "1999-01-01" }]);
    const result = applyRoleVersions(previous, parsed, now);
    expect(result.roles[0].version).toBe(3);
  });

  it("treats a reorder as a change without bumping versions", () => {
    const two = normalizeRoles([cashier, { ...cashier, roleId: "b" }], CREATED);
    const result = applyRoleVersions(two, [{ ...cashier, roleId: "b" }, cashier], now);
    expect(result.changed).toBe(true);
    expect(result.updated).toEqual([]);
    expect(result.roles.map((role) => role.version)).toEqual([1, 1]);
  });
});

describe("EdgeRoleUpdateSchema", () => {
  const valid = { baseVersion: 3, roleName: "Cashier", accessKeys: cashier.accessKeys };
  const page = (value: Record<string, unknown>) => ({
    ...valid,
    accessKeys: { electron: { pages: [{ key: "pos", enabled: true, featureFlags: {}, ...value }] } }
  });

  it("accepts a well-formed role and fills the missing app and flags", () => {
    const parsed = EdgeRoleUpdateSchema.parse({
      baseVersion: 1,
      roleName: "  Cashier ",
      accessKeys: { electron: { pages: [{ key: "pos", enabled: true }] } }
    });
    expect(parsed.roleName).toBe("Cashier");
    expect(parsed.accessKeys.mobile.pages).toEqual([]);
    expect(parsed.accessKeys.electron.pages[0].featureFlags).toEqual({});
    expect(EdgeRoleUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a page key that is not a string", page({ key: 7 })],
    ["enabled that is not a boolean", page({ enabled: "yes" })],
    ["a feature flag that is not a boolean", page({ featureFlags: { enableRefunds: "true" } })],
    ["featureFlags that is not a map", page({ featureFlags: ["enableRefunds"] })],
    ["an empty role name", { ...valid, roleName: "   " }],
    ["a role name over 80 characters", { ...valid, roleName: "x".repeat(81) }],
    ["a fractional baseVersion", { ...valid, baseVersion: 1.5 }],
    ["baseVersion 0", { ...valid, baseVersion: 0 }],
    ["a missing baseVersion", { roleName: "Cashier", accessKeys: cashier.accessKeys }],
    [
      "a page listed twice",
      {
        ...valid,
        accessKeys: {
          electron: {
            pages: [
              { key: "pos", enabled: true, featureFlags: {} },
              { key: "pos", enabled: false, featureFlags: {} }
            ]
          }
        }
      }
    ]
  ])("refuses %s", (_label, body) => {
    expect(EdgeRoleUpdateSchema.safeParse(body).success).toBe(false);
  });

  it("allows a role name of exactly 80 characters", () => {
    expect(EdgeRoleUpdateSchema.safeParse({ ...valid, roleName: "x".repeat(80) }).success).toBe(true);
  });
});

describe("RoleListSchema", () => {
  it("refuses two roles with the same id", () => {
    expect(RoleListSchema.safeParse([cashier, cashier]).success).toBe(false);
  });

  it("accepts the default roles as stored", () => {
    expect(RoleListSchema.safeParse(DEFAULT_ORG_ROLES).success).toBe(true);
  });
});

describe("canonicalJson", () => {
  it("does not depend on key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: undefined } })).toBe(
      canonicalJson({ a: { d: [2, { x: 2, y: 1 }] }, b: 1 })
    );
    expect(canonicalJson({ at: new Date(CREATED) })).toBe(`{"at":"${CREATED}"}`);
  });
});
