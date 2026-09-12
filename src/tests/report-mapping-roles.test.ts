import { describe, expect, it } from "vitest";
import { getPage } from "@/config/pages";
import { ROLE_TEMPLATES, templateRoles } from "@/lib/role-templates";
import { DEFAULT_ORG_ROLES } from "@/lib/roles";
import { editorAccessKeys, pagesFor, templateAccessKeys } from "@/app/admin/_lib/registry";

/**
 * Report mapping is a section inside Settings: the `settings` page's feature
 * flag `reportMapping` (off by default in the registry), on in the
 * Organization Admin and Store Manager templates only. The role editor lists
 * it under Settings from the registry, like Price Groups under Price Book.
 */

type Page = { key: string; enabled: boolean; featureFlags: Record<string, boolean> };
const flagIn = (pages: Page[]) => pages.find((page) => page.key === "settings")?.featureFlags.reportMapping;

describe("the reportMapping flag on Settings", () => {
  it("is a flag of the settings page in the registry, not a page", () => {
    expect(getPage("settings")?.knownFeatureFlags.reportMapping).toMatchObject({ label: "Report mapping", default: false });
    expect(getPage("reportMapping")).toBeUndefined();
    expect(pagesFor("electron").map((page) => page.key)).not.toContain("reportMapping");
  });

  it("is on for Organization Admin and Store Manager, off for Cashier and Viewer (server templates)", () => {
    const byId = Object.fromEntries(ROLE_TEMPLATES.map((template) => [template.templateId, template.accessKeys.electron.pages]));
    expect(flagIn(byId.org_admin)).toBe(true);
    expect(flagIn(byId.store_manager)).toBe(true);
    expect(flagIn(byId.cashier)).toBe(false);
    expect(flagIn(byId.viewer)).toBe(false);
    for (const pages of Object.values(byId)) expect(pages.map((page) => page.key)).not.toContain("reportMapping");
    // New organizations get the templates as stored roles.
    const stored = Object.fromEntries(templateRoles(new Date()).map((role) => [role.roleId, role.accessKeys.electron.pages]));
    expect(flagIn(stored.store_manager)).toBe(true);
    expect(flagIn(stored.cashier)).toBe(false);
  });

  it("the admin UI's templates match, and the fallback Organization Admin has it", () => {
    for (const template of ["org_admin", "store_manager", "cashier", "viewer", "blank"] as const) {
      const server = template === "blank" ? false : flagIn(ROLE_TEMPLATES.find((entry) => entry.templateId === template)!.accessKeys.electron.pages);
      expect(flagIn(templateAccessKeys(template).electron.pages)).toBe(server);
    }
    const fallback = DEFAULT_ORG_ROLES[0].accessKeys.electron.pages as Page[];
    expect(flagIn(fallback)).toBe(true);
    expect(fallback.map((page) => page.key)).not.toContain("reportMapping");
  });

  it("the role editor shows it under Settings, off for a stored role that predates it", () => {
    const older = { electron: { pages: [{ key: "settings", enabled: true, featureFlags: {} }] }, mobile: { pages: [] } };
    const settings = editorAccessKeys(older).electron.pages.find((page) => page.key === "settings");
    expect(settings).toMatchObject({ enabled: true, featureFlags: { reportMapping: false } });
  });
});
