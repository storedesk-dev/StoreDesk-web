/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source:    shared/pages-registry.ts (electron + mobile)
 * Regenerate: node scripts/generate-pages-registry.mjs
 * Verify:     node scripts/generate-pages-registry.mjs --check
 */

export type App = "electron" | "mobile";

export type StoreCapability = "lottery" | "coam" | "fuel";

export const STORE_CAPABILITIES: StoreCapability[] = ["lottery", "coam", "fuel"];

export interface PageFeatureFlagDef {
  label: string;
  description: string;
  default: boolean;
}

export interface PageDefinition {
  key: string;
  label: string;
  description: string;
  app: App;
  filePath: string;
  defaultEnabled: boolean;
  alwaysEnabled?: boolean;
  requiresCapability?: StoreCapability;
  knownFeatureFlags: Record<string, PageFeatureFlagDef>;
}

export const ALL_PAGES: PageDefinition[] = [
  {
    key: "pos",
    label: "POS Workspace",
    description: "Point-of-sale terminal — ring up sales, accept payment, open cash drawer.",
    app: "electron",
    filePath: "src/pages/POSWorkspacePage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableRefunds: { label: "Refunds", description: "Allow cashiers to process refunds.", default: true },
      enableDiscounts: { label: "Discounts", description: "Allow manual discount entry on line items.", default: true },
      enableVoidTransaction: { label: "Void Transaction", description: "Allow voiding an active transaction.", default: true },
      enableCashDrawer: { label: "Cash Drawer", description: "Trigger cash drawer open on payment.", default: true }
    }
  },
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview cards, setup checklist, server status, and recent activity.",
    app: "electron",
    filePath: "src/pages/DashboardPage.tsx",
    defaultEnabled: true,
    alwaysEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "products",
    label: "Products",
    description: "Product catalog management — add, edit, search products and variants.",
    app: "electron",
    filePath: "src/pages/ProductDetailPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableBulkImport: { label: "Bulk Import", description: "Allow CSV bulk product import.", default: false },
      enableBarcodeGeneration: { label: "Barcode Generation", description: "Generate internal barcodes for products.", default: true }
    }
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Vendor directory — add vendors, contacts, payment and delivery terms.",
    app: "electron",
    filePath: "src/pages/VendorsPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "priceBook",
    label: "Price Book",
    description: "Suggested and manual selling price management across all variants.",
    app: "electron",
    filePath: "src/pages/PriceBookPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {
      priceGroups: { label: "Price Groups", description: "Group items by rule or by hand and mass-update their price and info through the group.", default: true }
    }
  },
  {
    key: "costAnalysis",
    label: "Cost Analysis",
    description: "True cost comparison across vendors — price per item, per pack, per unit.",
    app: "electron",
    filePath: "src/pages/CostAnalysisPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "fuelPrices",
    label: "Fuel Center",
    description: "Fuel prices (in effect, pending, staged edits), pumps and their sales, and fuel sold by grade over chosen dates.",
    app: "electron",
    filePath: "src/pages/FuelPricesPage.tsx",
    defaultEnabled: true,
    requiresCapability: "fuel",
    knownFeatureFlags: {}
  },
  {
    key: "deals",
    label: "Deals",
    description: "Register combos and mix & match deals with their item lists and items (read-only).",
    app: "electron",
    filePath: "src/pages/DealsPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "registerChanges",
    label: "Register Changes",
    description: "Price and fuel changes staged for the register — review, cancel, or revert a batch.",
    app: "electron",
    filePath: "src/pages/RegisterChangesPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "transactions",
    label: "Transactions",
    description: "Transaction history, search, receipt reprint, and daily summary.",
    app: "electron",
    filePath: "src/pages/TransactionsPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableExport: { label: "Export", description: "Allow exporting transaction history to CSV.", default: true },
      enableRefundView: { label: "Refund View", description: "Show refunded transactions in the list.", default: true }
    }
  },
  {
    key: "manageWorker",
    label: "Manage Worker",
    description: "Edge server status, service controls, logs, and Cloudflare Tunnel status.",
    app: "electron",
    filePath: "src/pages/ManageWorkerPage.tsx",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "userManagement",
    label: "Users and Roles",
    description: "View the store's synced users and edit role access; changes sync to the control plane.",
    app: "electron",
    filePath: "src/pages/SettingsPage.tsx",
    defaultEnabled: false,
    knownFeatureFlags: {}
  },
  {
    key: "reportMapping",
    label: "Report Mapping",
    description: "Map the register's report lines (tax rates, departments, payment types, cards) to StoreDesk's daily numbers, Sales Tax and Google Sheet columns.",
    app: "electron",
    filePath: "src/pages/SettingsPage.tsx",
    defaultEnabled: false,
    knownFeatureFlags: {}
  },
  {
    key: "settings",
    label: "Settings",
    description: "Store settings — POS config, receipt template, tax rates, and preferences.",
    app: "electron",
    filePath: "src/pages/SettingsPage.tsx",
    defaultEnabled: true,
    alwaysEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "mobilePos",
    label: "POS Workspace",
    description: "Mobile point-of-sale — scan items, accept payment, print receipt.",
    app: "mobile",
    filePath: "lib/features/pos/pos_workspace_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableManualEntry: { label: "Manual Entry", description: "Allow manual item entry without scanning.", default: true },
      enableQuickSale: { label: "Quick Sale", description: "One-tap quick sale for common items.", default: false }
    }
  },
  {
    key: "mobileDashboard",
    label: "Dashboard",
    description: "Mobile home screen — connection status, quick actions, recent activity.",
    app: "mobile",
    filePath: "lib/features/dashboard/dashboard_screen.dart",
    defaultEnabled: true,
    alwaysEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "mobileScanner",
    label: "Barcode Scanner",
    description: "Camera barcode scanner — scan UPC to look up products and prices.",
    app: "mobile",
    filePath: "lib/features/scanner/scanner_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableCameraFlash: { label: "Camera Flash", description: "Allow toggling flashlight during scanning.", default: true },
      enableManualEntry: { label: "Manual Code", description: "Allow manual barcode entry as fallback.", default: true }
    }
  },
  {
    key: "mobileProductSearch",
    label: "Product Search",
    description: "Search products by name, UPC, or SKU.",
    app: "mobile",
    filePath: "lib/features/products/product_search_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "mobileVendorPrices",
    label: "Vendor Prices",
    description: "View and compare vendor pricing for a product on mobile.",
    app: "mobile",
    filePath: "lib/features/products/vendor_prices_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "mobilePriceBook",
    label: "Price Book",
    description: "View the selling price book and suggested prices on mobile.",
    app: "mobile",
    filePath: "lib/features/price_book/price_book_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {
      priceGroups: { label: "Price Groups", description: "View price groups and mass-update price through a group on mobile.", default: true }
    }
  },
  {
    key: "mobileFuelPrices",
    label: "Fuel Center",
    description: "Fuel prices with pending flags and staged edits, pumps and their sales, and fuel sold by grade on mobile.",
    app: "mobile",
    filePath: "lib/features/fuel/fuel_prices_screen.dart",
    defaultEnabled: true,
    requiresCapability: "fuel",
    knownFeatureFlags: {}
  },
  {
    key: "mobileDeals",
    label: "Deals",
    description: "Register combos and mix & match deals with their items on mobile (read-only).",
    app: "mobile",
    filePath: "lib/features/deals/deals_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {}
  },
  {
    key: "mobileTransactions",
    label: "Transactions",
    description: "View transaction history on mobile.",
    app: "mobile",
    filePath: "lib/features/transactions/transactions_screen.dart",
    defaultEnabled: true,
    knownFeatureFlags: {
      enableExport: { label: "Export", description: "Allow exporting transactions to CSV from mobile.", default: false }
    }
  },
  {
    key: "mobileReports",
    label: "Reports",
    description: "Sales and inventory reports on mobile.",
    app: "mobile",
    filePath: "lib/features/reports/reports_screen.dart",
    defaultEnabled: false,
    knownFeatureFlags: {}
  },
  {
    key: "mobileAnalytics",
    label: "Analytics",
    description: "Analytics dashboard — revenue charts, top products, and trends.",
    app: "mobile",
    filePath: "lib/features/analytics/analytics_screen.dart",
    defaultEnabled: false,
    knownFeatureFlags: {}
  },
  {
    key: "mobileSalesTax",
    label: "Sales Tax",
    description: "Sales tax management and rate configuration on mobile.",
    app: "mobile",
    filePath: "lib/features/sales_tax/sales_tax_screen.dart",
    defaultEnabled: false,
    knownFeatureFlags: {}
  },
  {
    key: "mobileSettings",
    label: "Settings",
    description: "Mobile app settings, preferences, and debugging.",
    app: "mobile",
    filePath: "lib/features/settings/settings_screen.dart",
    defaultEnabled: true,
    alwaysEnabled: true,
    knownFeatureFlags: {}
  }
];

export const PAGE_KEYS: string[] = ALL_PAGES.map((page) => page.key);

export function getPage(key: string): PageDefinition | undefined {
  return ALL_PAGES.find((page) => page.key === key);
}
