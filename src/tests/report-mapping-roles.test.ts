import { describe, expect, it } from "vitest";
import { getPage } from "@/config/pages";
import { ROLE_TEMPLATES, templateRoles } from "@/lib/role-templates";
import { DEFAULT_ORG_ROLES } from "@/lib/roles";
import { editorAccessKeys, pagesFor, templateAccessKeys } from "@/app/admin/_lib/registry";

/**
 * Report Mapping (desktop page `reportMapping`, off by default in the
 * registry): on in the Organization Admin and Store Manager templates only.
 * The role editor and access preview list it from the registry.
 */

const enabledIn = (pages: Array<{ key: string; enabled: boolean }>) => pages.find((page) => page.key === "reportMapping")?.enabled;

describe("reportMapping in the role templates", () => {
  it("is a desktop page named Report Mapping in the registry", () => {
    expect(getPage("reportMapping")).toMatchObject({ app: "electron", label: "Report Mapping", defaultEnabled: false });
    expect(pagesFor("electron").map((page) => page.key)).toContain("reportMapping");
    expect(pagesFor("mobile").map((page) => page.key)).not.toContain("reportMapping");
  });

  it("is on for Organization Admin and Store Manager, off for Cashier and Viewer (server templates)", () => {
    const byId = Object.fromEntries(ROLE_TEMPLATES.map((template) => [template.templateId, template.accessKeys.electron.pages]));
    expect(enabledIn(byId.org_admin)).toBe(true);
    expect(enabledIn(byId.store_manager)).toBe(true);
    expect(enabledIn(byId.cashier)).toBe(false);
    expect(enabledIn(byId.viewer)).toBe(false);
    // New organizations get the templates as stored roles.
    const stored = Object.fromEntries(templateRoles(new Date()).map((role) => [role.roleId, role.accessKeys.electron.pages]));
    expect(enabledIn(stored.store_manager)).toBe(true);
    expect(enabledIn(stored.cashier)).toBe(false);
  });

  it("the admin UI's templates match, and the fallback Organization Admin has it", () => {
    for (const template of ["org_admin", "store_manager", "cashier", "viewer", "blank"] as const) {
      const server = template === "blank" ? false : enabledIn(ROLE_TEMPLATES.find((entry) => entry.templateId === template)!.accessKeys.electron.pages);
      expect(enabledIn(templateAccessKeys(template).electron.pages)).toBe(server);
    }
    expect(enabledIn(DEFAULT_ORG_ROLES[0].accessKeys.electron.pages)).toBe(true);
  });

  it("the role editor lists it for a stored role that predates it, switched off", () => {
    const older = { electron: { pages: [{ key: "pos", enabled: true, featureFlags: {} }] }, mobile: { pages: [] } };
    expect(enabledIn(editorAccessKeys(older).electron.pages)).toBe(false);
  });
});
