import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORG_ROLES,
  EdgeRoleUpdateSchema,
  normalizeAccessKeys,
  normalizeRoles,
  orgAdminAccessKeys,
  orgAdminRoleOutdated,
  resolveOrgAdminRole,
  resolveSplitSettingsPages,
  splitSettingsOutdated,
  unknownPageKeys
} from "@/lib/roles";
import { canonicalJson } from "@/lib/control-plane-security";
import { ALL_PAGES, getPage } from "@/config/pages";
import { ROLE_TEMPLATES, blankAccessKeys } from "@/lib/role-templates";
import { countEnabled, editorAccessKeys, isRetired, newAccessItems, pagesFor, roleFingerprint, templateAccessKeys } from "@/app/admin/_lib/registry";

const CREATED = "2030-01-01T00:00:00.000Z";

const cashier = {
  roleId: "cashier",
  roleName: "Cashier",
  accessKeys: {
    // Saved after Sales Tax and Store settings left Settings, so it names both (off).
    electron: {
      pages: [
        { key: "pos", enabled: true, featureFlags: { enableRefunds: false } },
        { key: "salesTax", enabled: false, featureFlags: {} },
        { key: "storeSettings", enabled: false, featureFlags: {} }
      ]
    },
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
      // A role from before the split gains Sales Tax and Store settings, off (nothing trusts it).
      electron: {
        pages: [
          { key: "pos", enabled: false, featureFlags: { a: true } },
          { key: "salesTax", enabled: false, featureFlags: {} },
          { key: "storeSettings", enabled: false, featureFlags: {} }
        ]
      },
      mobile: { pages: [] },
      // A role stored before StoreDesk Lottery existed reads with an empty block, never a granted one.
      lottery: { pages: [] }
    });
  });
});

describe("the Organization Admin role (org_admin)", () => {
  const registered = (app: "electron" | "mobile") => ALL_PAGES.filter((page) => page.app === app && !page.retired);
  // What a live store had: 10 pages per app, no Deals, no price-groups flag.
  const old = {
    roleId: "org_admin",
    roleName: "Organization Admin",
    version: 5,
    accessKeys: {
      electron: { pages: registered("electron").filter((p) => p.key !== "deals").slice(0, 10).map((p) => ({ key: p.key, enabled: true, featureFlags: {} })) },
      mobile: {
        pages: [
          ...registered("mobile").filter((p) => p.key !== "mobileDeals").slice(0, 10).map((p) => ({ key: p.key, enabled: true, featureFlags: {} })),
          { key: "mobilePos", enabled: true, featureFlags: { enableQuickSale: true } }
        ]
      }
    }
  };

  it("resolves to every registered page with every flag, one version up, keeping retired pages", () => {
    const [admin, other] = normalizeRoles([old, { ...cashier, version: 2 }], CREATED);
    expect(admin.version).toBe(6);
    for (const app of ["electron", "mobile"] as const) {
      for (const def of registered(app)) {
        const page = admin.accessKeys[app].pages.find((entry) => entry.key === def.key);
        expect(page?.enabled, `${app}.${def.key}`).toBe(true);
        for (const flag of Object.keys(def.knownFeatureFlags)) expect(page?.featureFlags[flag], `${def.key}.${flag}`).toBe(true);
      }
    }
    // A flag added after the role was saved (register writes from the phone) is on for the admin.
    expect(admin.accessKeys.mobile.pages.find((page) => page.key === "mobilePriceBook")?.featureFlags.sendToRegister).toBe(true);
    expect(admin.accessKeys.mobile.pages).toContainEqual({ key: "mobilePos", enabled: true, featureFlags: { enableQuickSale: true } });
    expect(orgAdminRoleOutdated([old])).toBe(true);
    // Another role is never granted anything.
    expect(other).toMatchObject({ roleId: "cashier", version: 2, accessKeys: normalizeAccessKeys(cashier.accessKeys) });
  });

  it("keeps its version when it already has everything, whatever the order", () => {
    const full = orgAdminAccessKeys(normalizeAccessKeys(old.accessKeys));
    const reversed = {
      electron: { pages: [...full.electron.pages].reverse() },
      mobile: { pages: [...full.mobile.pages].reverse() },
      lottery: { pages: [...(full.lottery?.pages ?? [])].reverse() }
    };
    const [admin] = normalizeRoles([{ ...old, accessKeys: reversed }], CREATED);
    expect(admin.version).toBe(5);
    expect(admin.accessKeys).toEqual(reversed);
    expect(orgAdminRoleOutdated([{ ...old, accessKeys: reversed }])).toBe(false);
    expect(resolveOrgAdminRole({ ...admin, roleId: "store_manager" }).changed).toBe(false);
  });

  it("the defaults, never stored, read at version 1 with every page", () => {
    const [admin] = normalizeRoles([], CREATED);
    expect(admin.version).toBe(1);
    expect(admin.accessKeys.mobile.pages.map((page) => page.key).sort()).toEqual(registered("mobile").map((page) => page.key).sort());
    expect(orgAdminRoleOutdated([])).toBe(false);
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

describe("newAccessItems (the console's New pages available)", () => {
  it("lists pages a stored role doesn't name and flags its enabled pages don't carry, and nothing for a full role", () => {
    // Store Manager: it has the phone's Price Book on, so its flags are offered when missing.
    const manager = templateAccessKeys("store_manager");
    expect(newAccessItems(manager)).toEqual([]);
    const stale = {
      electron: { pages: manager.electron.pages.filter((page) => page.key !== "deals") },
      mobile: {
        pages: manager.mobile.pages
          .filter((page) => page.key !== "mobileDeals")
          .map((page) => (page.key === "mobilePriceBook" ? { ...page, featureFlags: {} } : page))
      },
      lottery: manager.lottery ?? { pages: [] }
    };
    const items = newAccessItems(stale);
    expect(items.map(({ app, pageKey, flag }) => `${app}.${pageKey}${flag ? `.${flag}` : ""}`).sort()).toEqual(
      ["electron.deals", "mobile.mobileDeals", "mobile.mobilePriceBook.priceGroups", "mobile.mobilePriceBook.sendToRegister"].sort()
    );
  });
});

/**
 * The Viewer template is read-only. The Deals pages stage register changes
 * (a deal staged there is sent to the register), so a role called "Viewer"
 * must not carry them — on the server templates or in the admin console's
 * copy of them.
 */
describe("the Viewer template is read-only", () => {
  const enabledKeys = (pages: { key: string; enabled: boolean }[]) =>
    pages.filter((page) => page.enabled).map((page) => page.key);

  it("does not enable the deals pages, on either side", () => {
    const viewer = ROLE_TEMPLATES.find((template) => template.templateId === "viewer")!;
    expect(enabledKeys(viewer.accessKeys.electron.pages)).not.toContain("deals");
    expect(enabledKeys(viewer.accessKeys.mobile.pages)).not.toContain("mobileDeals");

    const console = templateAccessKeys("viewer");
    expect(enabledKeys(console.electron.pages)).not.toContain("deals");
    expect(enabledKeys(console.mobile.pages)).not.toContain("mobileDeals");
  });

  it("still lists them (so the console can offer them) and leaves the other templates alone", () => {
    const viewer = ROLE_TEMPLATES.find((template) => template.templateId === "viewer")!;
    expect(viewer.accessKeys.electron.pages.map((page) => page.key)).toContain("deals");
    expect(viewer.accessKeys.mobile.pages.map((page) => page.key)).toContain("mobileDeals");

    const manager = ROLE_TEMPLATES.find((template) => template.templateId === "store_manager")!;
    expect(enabledKeys(manager.accessKeys.electron.pages)).toContain("deals");
    expect(enabledKeys(manager.accessKeys.mobile.pages)).toContain("mobileDeals");
  });

  it("reads the same on both sides, page for page", () => {
    const viewer = ROLE_TEMPLATES.find((template) => template.templateId === "viewer")!;
    const console = templateAccessKeys("viewer");
    for (const app of ["electron", "mobile"] as const) {
      expect(enabledKeys(console[app].pages).sort()).toEqual(enabledKeys(viewer.accessKeys[app].pages).sort());
    }
  });
});

/**
 * Sales Tax (`salesTax`) and Store settings (`storeSettings`) used to ride on the always-on Settings
 * page, so a Cashier or Viewer could add a bank account, mark a return filed or change the register
 * login. Templates for those two never grant them; stored roles from before are resolved once.
 */
describe("Sales Tax and Store settings, split out of Settings", () => {
  const enabledKeys = (pages: { key: string; enabled: boolean }[]) =>
    pages.filter((page) => page.enabled).map((page) => page.key);
  const template = (id: string) => ROLE_TEMPLATES.find((entry) => entry.templateId === id)!;

  it("Cashier and Viewer templates have neither, nor the Price Book; Manager and Admin have both", () => {
    for (const id of ["cashier", "viewer"]) {
      const server = enabledKeys(template(id).accessKeys.electron.pages);
      const console = enabledKeys(templateAccessKeys(id as "cashier" | "viewer").electron.pages);
      for (const keys of [server, console]) {
        expect(keys).toContain("settings");
        expect(keys).not.toContain("salesTax");
        expect(keys).not.toContain("storeSettings");
      }
    }
    expect(enabledKeys(template("viewer").accessKeys.electron.pages)).not.toContain("priceBook");
    expect(enabledKeys(template("viewer").accessKeys.mobile.pages)).not.toContain("mobilePriceBook");
    for (const id of ["store_manager", "org_admin"]) {
      expect(enabledKeys(template(id).accessKeys.electron.pages)).toEqual(expect.arrayContaining(["salesTax", "storeSettings"]));
    }
  });

  const stored = (roleId: string, electron: { key: string; enabled: boolean; featureFlags?: Record<string, boolean> }[], mobile: string[] = []) => ({
    roleId,
    roleName: roleId,
    version: 3,
    updatedAt: CREATED,
    accessKeys: {
      electron: { pages: electron.map((page) => ({ featureFlags: {}, ...page })) },
      mobile: { pages: mobile.map((key) => ({ key, enabled: true, featureFlags: {} })) },
      lottery: { pages: [] }
    }
  });
  const grantOf = (role: ReturnType<typeof stored>) => {
    const { role: next, changed } = resolveSplitSettingsPages(role);
    const on = (key: string) => next.accessKeys.electron.pages.find((page) => page.key === key)?.enabled;
    return { changed, version: next.version, salesTax: on("salesTax"), storeSettings: on("storeSettings") };
  };

  it("a stored cashier or viewer gets both, switched off, one version up", () => {
    const settings = { key: "settings", enabled: true };
    expect(grantOf(stored("cashier", [{ key: "pos", enabled: true }, settings]))).toEqual({ changed: true, version: 4, salesTax: false, storeSettings: false });
    expect(grantOf(stored("viewer", [{ key: "priceBook", enabled: true }, settings]))).toEqual({ changed: true, version: 4, salesTax: false, storeSettings: false });
  });

  it("an owner or manager keeps both: Store Manager, Users and Roles, the service page, or Report mapping", () => {
    const settings = { key: "settings", enabled: true };
    const both = { changed: true, version: 4, salesTax: true, storeSettings: true };
    expect(grantOf(stored("store_manager", [settings]))).toEqual(both);
    expect(grantOf(stored("owner", [settings, { key: "userManagement", enabled: true }]))).toEqual(both);
    expect(grantOf(stored("it", [settings, { key: "manageWorker", enabled: true }]))).toEqual(both);
    expect(grantOf(stored("books", [{ key: "settings", enabled: true, featureFlags: { reportMapping: true } }]))).toEqual(both);
    // A switched-off page or flag is not trust.
    expect(grantOf(stored("x", [{ key: "settings", enabled: true, featureFlags: { reportMapping: false } }, { key: "userManagement", enabled: false }])).salesTax).toBe(false);
  });

  it("a role given the phone's Sales Tax keeps filing from the phone (it now needs the desktop's salesTax)", () => {
    expect(grantOf(stored("bookkeeper", [{ key: "settings", enabled: true }], ["mobileSalesTax"]))).toEqual({
      changed: true,
      version: 4,
      salesTax: true,
      storeSettings: false
    });
  });

  it("happens once: a role naming either key keeps its choice, and the admin is left to its own rule", () => {
    const decided = stored("cashier", [{ key: "salesTax", enabled: true }, { key: "storeSettings", enabled: false }]);
    expect(resolveSplitSettingsPages(decided)).toEqual({ role: decided, changed: false });
    expect(splitSettingsOutdated([decided])).toBe(false);
    expect(splitSettingsOutdated([stored("cashier", [{ key: "pos", enabled: true }])])).toBe(true);
    expect(splitSettingsOutdated([{ roleId: "org_admin", accessKeys: {} }])).toBe(false);
    // Only the missing key is added; the one already named is untouched.
    const half = stored("store_manager", [{ key: "salesTax", enabled: false }]);
    const next = resolveSplitSettingsPages(half).role.accessKeys.electron.pages;
    expect(next).toEqual([
      { key: "salesTax", enabled: false, featureFlags: {} },
      { key: "storeSettings", enabled: true, featureFlags: {} }
    ]);
  });

  it("normalizeRoles reads stored roles with the split applied, and the Organization Admin with both on", () => {
    const [admin, cashierRole] = normalizeRoles(
      [stored("org_admin", [{ key: "settings", enabled: true }]), stored("cashier", [{ key: "settings", enabled: true }])],
      CREATED
    );
    expect(enabledKeys(admin.accessKeys.electron.pages)).toEqual(expect.arrayContaining(["salesTax", "storeSettings"]));
    expect(enabledKeys(cashierRole.accessKeys.electron.pages)).toEqual(["settings"]);
    expect(cashierRole.version).toBe(4);
  });
});
