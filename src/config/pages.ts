/**
 * StoreDesk Web Admin — Page Registry Mirror
 *
 * ⚠️  KEEP IN SYNC WITH: shared/pages-registry.ts (root repo)
 *
 * Cannot import directly from root because store-desk-web is a
 * separate Git submodule. Keep this copy in sync manually.
 * Verify sync: node scripts/verify-pages-registry.js (run from root)
 */

export type App = "electron" | "mobile";

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
  knownFeatureFlags: Record<string, PageFeatureFlagDef>;
}

export const ELECTRON_PAGES: PageDefinition[] = [
  { key: "pos",            label: "POS Workspace",   description: "Point-of-sale terminal.",                     app: "electron", filePath: "src/pages/POSWorkspacePage.tsx",   defaultEnabled: true,  knownFeatureFlags: { enableRefunds: { label: "Refunds", description: "Allow refunds.", default: true }, enableDiscounts: { label: "Discounts", description: "Allow discounts.", default: true }, enableVoidTransaction: { label: "Void Txn", description: "Allow void.", default: true }, enableCashDrawer: { label: "Cash Drawer", description: "Open cash drawer.", default: true } } },
  { key: "dashboard",      label: "Dashboard",        description: "Overview cards and setup checklist.",          app: "electron", filePath: "src/pages/DashboardPage.tsx",      defaultEnabled: true, alwaysEnabled: true, knownFeatureFlags: {} },
  { key: "products",       label: "Products",         description: "Product catalog management.",                  app: "electron", filePath: "src/pages/ProductDetailPage.tsx",  defaultEnabled: true,  knownFeatureFlags: { enableBulkImport: { label: "Bulk Import", description: "CSV import.", default: false }, enableBarcodeGeneration: { label: "Barcode Gen", description: "Generate barcodes.", default: true } } },
  { key: "vendors",        label: "Vendors",          description: "Vendor directory.",                            app: "electron", filePath: "src/pages/VendorsPage.tsx",        defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "vendorPrices",   label: "Vendor Prices",    description: "Manual vendor price entry.",                   app: "electron", filePath: "src/pages/VendorPricesPage.tsx",   defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "priceBook",      label: "Price Book",       description: "Selling price management.",                    app: "electron", filePath: "src/pages/PriceBookPage.tsx",      defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "pricingRules",   label: "Pricing Rules",    description: "Margin/markup and rounding rules.",            app: "electron", filePath: "src/pages/PricingRulesPage.tsx",   defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "costAnalysis",   label: "Cost Analysis",    description: "Cross-vendor cost comparison.",                app: "electron", filePath: "src/pages/CostAnalysisPage.tsx",   defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "transactions",   label: "Transactions",     description: "Transaction history and reporting.",            app: "electron", filePath: "src/pages/TransactionsPage.tsx",   defaultEnabled: true,  knownFeatureFlags: { enableExport: { label: "Export CSV", description: "Export to CSV.", default: true }, enableRefundView: { label: "Refund View", description: "Show refunds.", default: true } } },
  { key: "manageWorker",   label: "Manage Worker",    description: "Edge server status and controls.",             app: "electron", filePath: "src/pages/ManageWorkerPage.tsx",   defaultEnabled: true,  knownFeatureFlags: {} },

  { key: "settings",       label: "Settings",         description: "Store settings and POS config.",               app: "electron", filePath: "src/pages/SettingsPage.tsx",       defaultEnabled: true, alwaysEnabled: true, knownFeatureFlags: {} },
];

export const MOBILE_PAGES: PageDefinition[] = [
  { key: "mobilePos",           label: "POS Workspace",         description: "Mobile point-of-sale.",              app: "mobile", filePath: "lib/features/pos/pos_workspace_screen.dart",            defaultEnabled: true,  knownFeatureFlags: { enableManualEntry: { label: "Manual Entry", description: "Manual item entry.", default: true }, enableQuickSale: { label: "Quick Sale", description: "One-tap sale.", default: false } } },
  { key: "mobileDashboard",     label: "Dashboard",             description: "Mobile home screen.",                app: "mobile", filePath: "lib/features/dashboard/dashboard_screen.dart",          defaultEnabled: true, alwaysEnabled: true, knownFeatureFlags: {} },
  { key: "mobileScanner",       label: "Barcode Scanner",       description: "Camera barcode scanner.",            app: "mobile", filePath: "lib/features/scanner/scanner_screen.dart",              defaultEnabled: true,  knownFeatureFlags: { enableCameraFlash: { label: "Camera Flash", description: "Flashlight toggle.", default: true }, enableManualEntry: { label: "Manual Code", description: "Manual code entry.", default: true } } },
  { key: "mobileProductSearch", label: "Product Search",        description: "Search products by name/UPC.",       app: "mobile", filePath: "lib/features/products/product_search_screen.dart",      defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "mobileVendorPrices",  label: "Vendor Prices (Mobile)",description: "View vendor pricing on mobile.",    app: "mobile", filePath: "lib/features/products/vendor_prices_screen.dart",       defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "mobilePriceBook",     label: "Price Book (Mobile)",   description: "View selling prices on mobile.",    app: "mobile", filePath: "lib/features/price_book/price_book_screen.dart",        defaultEnabled: true,  knownFeatureFlags: {} },
  { key: "mobileTransactions",  label: "Transactions (Mobile)", description: "View transaction history.",         app: "mobile", filePath: "lib/features/transactions/transactions_screen.dart",    defaultEnabled: true,  knownFeatureFlags: { enableExport: { label: "Export CSV", description: "Export transactions.", default: false } } },
  { key: "mobileReports",       label: "Reports (Mobile)",      description: "Sales and inventory reports.",      app: "mobile", filePath: "lib/features/reports/reports_screen.dart",             defaultEnabled: false, knownFeatureFlags: {} },
  { key: "mobileAnalytics",     label: "Analytics (Mobile)",    description: "Revenue charts and trends.",        app: "mobile", filePath: "lib/features/analytics/analytics_screen.dart",         defaultEnabled: false, knownFeatureFlags: {} },
  { key: "mobileSalesTax",      label: "Sales Tax (Mobile)",    description: "Sales tax management.",             app: "mobile", filePath: "lib/features/sales_tax/sales_tax_screen.dart",         defaultEnabled: false, knownFeatureFlags: {} },
];

export const ALL_PAGES: PageDefinition[] = [...ELECTRON_PAGES, ...MOBILE_PAGES];
export const ELECTRON_PAGE_KEYS = ELECTRON_PAGES.map(p => p.key);
export const MOBILE_PAGE_KEYS   = MOBILE_PAGES.map(p => p.key);
export function getPage(key: string): PageDefinition | undefined { return ALL_PAGES.find(p => p.key === key); }
