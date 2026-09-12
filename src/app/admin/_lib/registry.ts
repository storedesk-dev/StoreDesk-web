/**
 * Page-registry helpers for the role editor, templates and access preview.
 *
 * Reads the generated registry (src/config/pages.ts, from shared/pages-registry.ts)
 * so every editor lists every page for both apps — never only the pages a role
 * already has.
 */

import { ALL_PAGES, getPage, type App, type PageDefinition, type StoreCapability } from "@/config/pages";
import type { RoleAccessKeys, RolePage, RoleTemplate } from "./api";

export const APPS: Array<{ key: App; label: string }> = [
  { key: "electron", label: "Desktop" },
  { key: "mobile", label: "Phone" }
];

export const CAPABILITY_LABEL: Record<StoreCapability, string> = {
  fuel: "fuel",
  lottery: "lottery",
  coam: "COAM"
};

export function pagesFor(app: App): PageDefinition[] {
  return ALL_PAGES.filter((page) => page.app === app);
}

export function pageLabel(key: string): string {
  return getPage(key)?.label ?? key;
}

export function defaultFlags(page: PageDefinition): Record<string, boolean> {
  return Object.fromEntries(Object.entries(page.knownFeatureFlags).map(([k, def]) => [k, def.default]));
}

/**
 * The editor's view of one app: one entry per registry page, in registry order,
 * merged with what the role has stored. `alwaysEnabled` pages read as on.
 * Stored pages the registry no longer knows are kept at the end, untouched, so a
 * save never silently drops them.
 */
export function editorPages(app: App, stored: RolePage[]): RolePage[] {
  const byKey = new Map(stored.map((page) => [page.key, page]));
  const known = pagesFor(app).map((def) => {
    const current = byKey.get(def.key);
    return {
      key: def.key,
      enabled: def.alwaysEnabled ? true : Boolean(current?.enabled),
      featureFlags: { ...defaultFlags(def), ...(current?.featureFlags ?? {}) }
    };
  });
  const knownKeys = new Set(known.map((page) => page.key));
  return [...known, ...stored.filter((page) => !knownKeys.has(page.key))];
}

export function editorAccessKeys(accessKeys: RoleAccessKeys | undefined): RoleAccessKeys {
  return {
    electron: { pages: editorPages("electron", accessKeys?.electron.pages ?? []) },
    mobile: { pages: editorPages("mobile", accessKeys?.mobile.pages ?? []) }
  };
}

// ── Templates ────────────────────────────────────────────────────────────────

interface TemplateDef {
  label: string;
  description: string;
  /** Pages switched on; `"*"` means every page. */
  electron: string[] | "*";
  mobile: string[] | "*";
  /** Flag overrides, by page key; otherwise the registry defaults. `"*": true` turns every flag on. */
  flags?: Record<string, Record<string, boolean>>;
  allFlags?: boolean;
}

export const ROLE_TEMPLATES: Record<Exclude<RoleTemplate, "blank">, TemplateDef> = {
  org_admin: {
    label: "Organization Admin",
    description: "Every page and every feature, including users and the store server.",
    electron: "*",
    mobile: "*",
    allFlags: true
  },
  store_manager: {
    label: "Store Manager",
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
    label: "Cashier",
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
    label: "Viewer",
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

/** Full access keys (every registry page, both apps) for a template. */
export function templateAccessKeys(template: RoleTemplate): RoleAccessKeys {
  const build = (app: App): RolePage[] =>
    pagesFor(app).map((def) => {
      if (template === "blank") {
        return { key: def.key, enabled: Boolean(def.alwaysEnabled), featureFlags: defaultFlags(def) };
      }
      const t = ROLE_TEMPLATES[template];
      const on = t[app];
      const enabled = Boolean(def.alwaysEnabled) || on === "*" || on.includes(def.key);
      const flags = t.allFlags
        ? Object.fromEntries(Object.keys(def.knownFeatureFlags).map((k) => [k, true]))
        : { ...defaultFlags(def), ...(t.flags?.[def.key] ?? {}) };
      return { key: def.key, enabled, featureFlags: flags };
    });
  return { electron: { pages: build("electron") }, mobile: { pages: build("mobile") } };
}

export function countEnabled(accessKeys: RoleAccessKeys, app: App): number {
  return accessKeys[app].pages.filter((page) => page.enabled).length;
}

/** Canonical string for dirty-checking an edited role. */
export function roleFingerprint(roleName: string, accessKeys: RoleAccessKeys): string {
  const sortObj = (o: Record<string, boolean>) =>
    Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  const norm = (pages: RolePage[]) =>
    [...pages]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((p) => ({ key: p.key, enabled: p.enabled, featureFlags: sortObj(p.featureFlags) }));
  return JSON.stringify({
    roleName: roleName.trim(),
    electron: norm(accessKeys.electron.pages),
    mobile: norm(accessKeys.mobile.pages)
  });
}
