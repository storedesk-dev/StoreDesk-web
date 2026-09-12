import { describe, expect, it } from "vitest";
import { DEFAULT_ORG_ROLES, EdgeRoleUpdateSchema, normalizeRoles } from "@/lib/roles";
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

describe("DEFAULT_ORG_ROLES", () => {
  it("is a valid role as the edge route accepts it", () => {
    for (const role of DEFAULT_ORG_ROLES) {
      expect(EdgeRoleUpdateSchema.safeParse({ baseVersion: 1, roleName: role.roleName, accessKeys: role.accessKeys }).success).toBe(true);
    }
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
