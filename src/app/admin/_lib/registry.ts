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
  { key: "mobile", label: "Phone" },
  { key: "lottery", label: "Lottery" }
];

export const CAPABILITY_LABEL: Record<StoreCapability, string> = {
  fuel: "fuel",
  lottery: "lottery",
  coam: "COAM",
  ebt: "EBT",
  moneyOrder: "money orders",
  prepaidGift: "prepaid and gift cards"
};

/** The pages an editor or template offers for an app: every registry page except retired ones. */
export function pagesFor(app: App): PageDefinition[] {
  return ALL_PAGES.filter((page) => page.app === app && !page.retired);
}

/**
 * A retired page of this app: the screen is gone but stored roles may still name
 * the key. The editor hides it and a save keeps it as stored.
 */
export function isRetired(app: App, key: string): boolean {
  const def = getPage(key);
  return Boolean(def?.retired && def.app === app);
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
 * Stored pages the registry no longer knows, and stored retired pages, are kept at
 * the end, untouched, so a save never silently drops them.
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
    mobile: { pages: editorPages("mobile", accessKeys?.mobile.pages ?? []) },
    // A role saved before StoreDesk Lottery existed has no block at all; it starts empty and the
    // editor lists every lottery page, off.
    lottery: { pages: editorPages("lottery", accessKeys?.lottery?.pages ?? []) }
  };
}

// ── Templates ────────────────────────────────────────────────────────────────

interface TemplateDef {
  label: string;
  description: string;
  /** Pages switched on; `"*"` means every page. */
  electron: string[] | "*";
  mobile: string[] | "*";
  lottery: string[] | "*";
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
    lottery: "*",
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
    ],
    // Everything in the lottery app, including correcting a day already closed.
    lottery: ["lottery", "lotteryClose", "lotteryCorrect", "lotteryReports"],
    // Report mapping is a section inside Settings.
    flags: { settings: { reportMapping: true } }
  },
  cashier: {
    label: "Cashier",
    description: "Rings up sales and looks items up. No refunds, discounts or voids.",
    electron: ["pos", "dashboard", "products", "transactions", "settings"],
    mobile: ["mobileDashboard", "mobileScanner", "mobileProductSearch", "mobileSettings"],
    // A cashier closes the till, which is the whole job at the counter. Correcting a day already
    // closed is a manager's, and the reports are the owner's.
    lottery: ["lottery", "lotteryClose"],
    flags: {
      pos: { enableRefunds: false, enableDiscounts: false, enableVoidTransaction: false, enableCashDrawer: true },
      products: { enableBulkImport: false, enableBarcodeGeneration: false },
      transactions: { enableExport: false, enableRefundView: false }
    }
  },
  // The Deals pages stage register changes, so read-only Viewer does not get
  // them (kept identical to lib/role-templates.ts).
  viewer: {
    label: "Viewer",
    description: "Looks, doesn't change: products, prices and transactions, read-only.",
    electron: ["dashboard", "products", "priceBook", "transactions", "settings"],
    mobile: [
      "mobileDashboard",
      "mobileScanner",
      "mobileProductSearch",
      "mobilePriceBook",
      "mobileTransactions",
      "mobileSettings"
    ],
    // Looks, doesn't change: the rack as it stands, and nothing that closes or corrects a day.
    lottery: ["lottery"],
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
  return { electron: { pages: build("electron") }, mobile: { pages: build("mobile") }, lottery: { pages: build("lottery") } };
}

/** The role that always has every page and flag (the control plane resolves it; lib/roles.ts). */
export const ORG_ADMIN_ROLE_ID = "org_admin";

export interface NewAccessItem {
  app: App;
  pageKey: string;
  /** Set for a flag added to a page the role already lists. */
  flag?: string;
  label: string;
}

/**
 * Pages and flags added to the registry since this role was saved: a page the
 * stored role does not list, or a flag its stored page does not carry. A store
 * denies them until the role is saved with them on (a flag must be literally
 * true), so the console points them out instead of granting them.
 */
export function newAccessItems(accessKeys: RoleAccessKeys): NewAccessItem[] {
  const items: NewAccessItem[] = [];
  for (const { key: app } of APPS) {
    const byKey = new Map((accessKeys[app]?.pages ?? []).map((page) => [page.key, page]));
    for (const def of pagesFor(app)) {
      const stored = byKey.get(def.key);
      if (!stored) {
        if (!def.alwaysEnabled) items.push({ app, pageKey: def.key, label: def.label });
        continue;
      }
      if (!stored.enabled) continue;
      for (const [flag, flagDef] of Object.entries(def.knownFeatureFlags)) {
        if (!(flag in stored.featureFlags)) items.push({ app, pageKey: def.key, flag, label: `${def.label}: ${flagDef.label}` });
      }
    }
  }
  return items;
}

/** Enabled pages the editor shows (a stored retired page is not counted). */
export function countEnabled(accessKeys: RoleAccessKeys, app: App): number {
  return (accessKeys[app]?.pages ?? []).filter((page) => page.enabled && !isRetired(app, page.key)).length;
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
