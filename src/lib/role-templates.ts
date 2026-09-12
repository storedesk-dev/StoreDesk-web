import { ALL_PAGES, type App } from "@/config/pages";
import type { OrgRole, RoleAccessKeys, RolePage } from "@/lib/roles";

/**
 * Role templates for new organizations and "New role from template" (P9, P10).
 * Built from the page registry, so every template lists every page of both
 * apps — enabled or not — with the registry's feature flags, and can never
 * name a page the apps don't have. The same definitions as the admin UI's
 * `src/app/admin/_lib/registry.ts`, so a role made on either side is identical.
 */

type TemplateDef = {
  roleName: string;
  description: string;
  /** Pages switched on; "*" is every page. Always-on pages are on regardless. */
  electron: string[] | "*";
  mobile: string[] | "*";
  /** Flag overrides by page key; otherwise the registry default. */
  flags?: Record<string, Record<string, boolean>>;
  /** Every flag on. */
  allFlags?: boolean;
};

const DEFINITIONS: Record<string, TemplateDef> = {
  org_admin: {
    roleName: "Organization Admin",
    description: "Every page and every feature, including users and the store server.",
    electron: "*",
    mobile: "*",
    allFlags: true
  },
  store_manager: {
    roleName: "Store Manager",
    description: "Runs the store day to day: prices, vendors, fuel, deals, transactions. No server or user admin.",
    electron: [
      "pos",
      "dashboard",
      "products",
      "vendors",
      "priceBook",
      "costAnalysis",
      "fuelPrices",
      "deals",
      "registerChanges",
      "transactions",
      "reportMapping",
      "settings"
    ],
    mobile: [
      "mobilePos",
      "mobileDashboard",
      "mobileScanner",
      "mobileProductSearch",
      "mobileVendorPrices",
      "mobilePriceBook",
      "mobileFuelPrices",
      "mobileDeals",
      "mobileTransactions",
      "mobileReports",
      "mobileSettings"
    ]
  },
  cashier: {
    roleName: "Cashier",
    description: "Rings up sales and looks items up. No refunds, discounts or voids.",
    electron: ["pos", "dashboard", "products", "transactions", "settings"],
    mobile: ["mobilePos", "mobileDashboard", "mobileScanner", "mobileProductSearch", "mobileSettings"],
    flags: {
      pos: { enableRefunds: false, enableDiscounts: false, enableVoidTransaction: false, enableCashDrawer: true },
      products: { enableBulkImport: false, enableBarcodeGeneration: false },
      transactions: { enableExport: false, enableRefundView: false },
      mobilePos: { enableQuickSale: true }
    }
  },
  viewer: {
    roleName: "Viewer",
    description: "Looks, doesn't change: products, prices, deals and transactions, read-only.",
    electron: ["dashboard", "products", "priceBook", "deals", "transactions", "settings"],
    mobile: [
      "mobileDashboard",
      "mobileScanner",
      "mobileProductSearch",
      "mobilePriceBook",
      "mobileDeals",
      "mobileTransactions",
      "mobileSettings"
    ],
    flags: {
      products: { enableBulkImport: false, enableBarcodeGeneration: false },
      priceBook: { priceGroups: false },
      mobilePriceBook: { priceGroups: false },
      transactions: { enableExport: false },
      mobileTransactions: { enableExport: false }
    }
  }
};

function build(app: App, def: TemplateDef | null): RolePage[] {
  return ALL_PAGES.filter((page) => page.app === app).map((page) => {
    const on = def?.[app];
    const enabled = page.alwaysEnabled === true || on === "*" || (Array.isArray(on) && on.includes(page.key));
    const featureFlags: Record<string, boolean> = {};
    for (const [flag, flagDef] of Object.entries(page.knownFeatureFlags)) {
      featureFlags[flag] = def?.allFlags ? true : (def?.flags?.[page.key]?.[flag] ?? flagDef.default);
    }
    return { key: page.key, enabled, featureFlags };
  });
}

export type RoleTemplate = {
  templateId: string;
  roleId: string;
  roleName: string;
  description: string;
  accessKeys: RoleAccessKeys;
};

export const ROLE_TEMPLATES: RoleTemplate[] = Object.entries(DEFINITIONS).map(([templateId, def]) => ({
  templateId,
  roleId: templateId,
  roleName: def.roleName,
  description: def.description,
  accessKeys: { electron: { pages: build("electron", def) }, mobile: { pages: build("mobile", def) } }
}));

export const TEMPLATE_IDS = ["org_admin", "store_manager", "cashier", "viewer", "blank"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function findTemplate(templateId: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((template) => template.templateId === templateId);
}

/** Every page listed, only the always-on ones enabled. */
export function blankAccessKeys(): RoleAccessKeys {
  return { electron: { pages: build("electron", null) }, mobile: { pages: build("mobile", null) } };
}

export function templateAccessKeys(templateId: TemplateId): RoleAccessKeys {
  if (templateId === "blank") return blankAccessKeys();
  return structuredClone(findTemplate(templateId)!.accessKeys);
}

/** The four templates as a new organization's stored roles, at version 1. */
export function templateRoles(now: Date): OrgRole[] {
  const stamp = now.toISOString();
  return ROLE_TEMPLATES.map((template) => ({
    roleId: template.roleId,
    roleName: template.roleName,
    version: 1,
    updatedAt: stamp,
    accessKeys: structuredClone(template.accessKeys)
  }));
}

export function templateSummaries() {
  return [
    ...ROLE_TEMPLATES.map(({ templateId, roleName, description }) => ({ templateId, roleName, description })),
    { templateId: "blank", roleName: "Blank", description: "Only the always-on pages." }
  ];
}
