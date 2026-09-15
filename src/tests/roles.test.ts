import { describe, expect, it } from "vitest";
import { DEFAULT_ORG_ROLES, EdgeRoleUpdateSchema, normalizeAccessKeys, normalizeRoles, unknownPageKeys } from "@/lib/roles";
import { canonicalJson } from "@/lib/control-plane-security";
import { ALL_PAGES, getPage } from "@/config/pages";
import { ROLE_TEMPLATES, blankAccessKeys } from "@/lib/role-templates";
import { countEnabled, editorAccessKeys, isRetired, pagesFor, roleFingerprint, templateAccessKeys } from "@/app/admin/_lib/registry";

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

describe("a retired page (mobilePos)", () => {
  // Existing organizations' roles still carry it, and a store server refuses a role
  // naming a key it doesn't know — so the key stays in the registry, offered nowhere.
  const retired = { key: "mobilePos", enabled: true, featureFlags: { enableManualEntry: false, enableQuickSale: true } };
  const stored = {
    electron: { pages: [{ key: "pos", enabled: true, featureFlags: { enableRefunds: false } }] },
    mobile: { pages: [{ key: "mobileScanner", enabled: true, featureFlags: {} }, retired] }
  };

  it("is still a known mobile page, off by default", () => {
    expect(getPage("mobilePos")).toMatchObject({ app: "mobile", retired: true, defaultEnabled: false });
    expect(unknownPageKeys(normalizeAccessKeys(stored), ALL_PAGES)).toEqual([]);
    expect(isRetired("mobile", "mobilePos")).toBe(true);
    expect(isRetired("electron", "mobilePos")).toBe(false);
  });

  it("is not offered by the role editor, any template or the default role", () => {
    expect(pagesFor("mobile").map((page) => page.key)).not.toContain("mobilePos");
    const blank = editorAccessKeys(undefined).mobile.pages.map((page) => page.key);
    expect(blank).not.toContain("mobilePos");
    for (const template of ["org_admin", "store_manager", "cashier", "viewer", "blank"] as const) {
      expect(templateAccessKeys(template).mobile.pages.map((page) => page.key)).not.toContain("mobilePos");
    }
    for (const template of ROLE_TEMPLATES) {
      expect(template.accessKeys.mobile.pages.map((page) => page.key)).not.toContain("mobilePos");
    }
    expect(blankAccessKeys().mobile.pages.map((page) => page.key)).not.toContain("mobilePos");
    expect(DEFAULT_ORG_ROLES[0].accessKeys.mobile.pages.map((page) => page.key)).not.toContain("mobilePos");
  });

  it("a stored role that has it round-trips through the editor and a save unchanged", () => {
    const draft = editorAccessKeys(stored);
    // Kept in the draft (so the save sends it), as stored, but not counted as a shown page.
    expect(draft.mobile.pages).toContainEqual(retired);
    expect(countEnabled(draft, "mobile")).toBe(countEnabled(editorAccessKeys({ ...stored, mobile: { pages: [stored.mobile.pages[0]] } }), "mobile"));
    // Opening the role is not an edit.
    expect(roleFingerprint("Cashier", editorAccessKeys(draft))).toBe(roleFingerprint("Cashier", draft));
    const saved = normalizeAccessKeys(EdgeRoleUpdateSchema.parse({ baseVersion: 1, roleName: "Cashier", accessKeys: draft }).accessKeys);
    expect(saved.mobile.pages).toContainEqual(retired);
    expect(unknownPageKeys(saved, ALL_PAGES)).toEqual([]);
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
