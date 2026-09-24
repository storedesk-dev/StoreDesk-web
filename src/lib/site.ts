/**
 * Facts about the product, in one place.
 *
 * Everything here is checked against the code it describes. Plan limits come
 * from `lib/licenses.ts` (license defaults), the session length from `CLIENT_SESSION_TTL_SECONDS`,
 * the setup-key window from `issueSetupKeyEmail`. If one of those changes, this
 * changes with it — marketing copy that drifts from the product is worse than
 * no copy.
 */

export const SITE = {
  name: "StoreDesk",
  email: "developer@storedesk.net",
  supportEmail: "developer@storedesk.net",
  domain: "storedesk.net",
  tagline: "Back-office software for convenience stores and gas stations",
  /** One sentence, used as the meta description and the hero subhead. */
  summary:
    "StoreDesk runs on the PC in your back office, reads prices straight from your Verifone Commander, and keeps working when the internet does not."
} as const;

/**
 * What the product actually does, one line each.
 *
 * The list is the pages that ship, from `shared/pages-registry.ts` — the same registry the desktop,
 * phone and server generate their page keys from. It had drifted to six entries written against the
 * old Node Worker while Fuel Center, Deals, Register Changes, Cost Analysis and Users and Roles had
 * all shipped; a site whose own tagline says "gas stations" was not mentioning fuel anywhere.
 *
 * It is also the `featureList` in the site's structured data (app/layout.tsx), so anything added
 * here has to be something a store can actually open today.
 */
export const CAPABILITIES = {
  /** priceBook — Features/PriceBook, page key `priceBook` */
  priceBook: "Every PLU from the register, searchable, with your vendor costs beside each one",
  /** costAnalysis + vendors — catalog price comparison */
  vendorCosts: "Every supplier's price on the same item, cheapest first",
  /** fuelPrices — page key `fuelPrices`, "Fuel Center" */
  fuel: "Fuel grades and pump prices, on the desktop and on a phone at the island",
  /** deals — page key `deals` */
  deals: "Multi-buy deals from the register, with what each one is really making",
  /** priceBook.priceGroups feature flag */
  priceGroups: "Group items and change price and information across the whole group at once",
  /** registerChanges + settings.registerWrites */
  registerChanges: "Stage price changes, check them, and send them to the register when you choose",
  /** transactions + POS reports — Features/PosReports */
  posReports: "Daily, shift and monthly sales pulled from the register, down to single transactions",
  /** Features/SalesTax — StateRules.Supported is ["GA"] */
  salesTax: "Georgia ST-3 sales tax returns generated as filing-ready XML",
  /** Integrations/Google */
  sheets: "Daily sales written to a Google Sheet you own",
  /** mobileScanner + mobilePriceBook */
  scanner: "Scan a barcode on the shop floor and see cost, price and margin",
  /** userManagement — page key `userManagement`, "Users and Roles" */
  roles: "Staff accounts you create, and per-screen control over what each person opens"
} as const;

/** Real limits from the control plane, not aspirational ones. */
export const PLANS = {
  trialDays: 30,
  standardDays: 365,
  /** A license's default PCs per store. */
  defaultMaxWorkers: 1,
  /** CLIENT_SESSION_TTL_SECONDS — one retail shift. */
  offlineSessionHours: 12,
  /** issueSetupKeyEmail */
  setupKeyHours: 24
} as const;

/** Opens the visitor's mail client with the subject pre-filled. */
export function contactMailto(options?: { subject?: string; body?: string }) {
  const params = new URLSearchParams();
  params.set("subject", options?.subject ?? "StoreDesk enquiry");
  if (options?.body) params.set("body", options.body);
  return `mailto:${SITE.email}?${params.toString()}`;
}

/** StoreDesk Mobile on Google Play. The phone app is listed, so Play is how a store installs it. */
export const PLAY_STORE_ID = "com.storedesk";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;

export const NAV = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
] as const;

/**
 * The user guide, at docs.storedesk.net — a separate site (store-desk-docs), so these are plain
 * links, never next/link. The apps deep-link into the same topics with /t/<topic>, which is the
 * stable address: a topic keeps its link when the page it lives on is renamed or moved.
 */
export const DOCS_BASE = "https://docs.storedesk.net";

export const DOCS = {
  home: DOCS_BASE,
  /** The three sections of the guide. */
  desktop: `${DOCS_BASE}/desktop/`,
  mobile: `${DOCS_BASE}/mobile/`,
  service: `${DOCS_BASE}/service/`,
  /** Topics the marketing pages link straight to; each one is in store-desk-docs/topics/topics.json. */
  topic: (topic: string) => `${DOCS_BASE}/t/${topic}`,
  install: `${DOCS_BASE}/t/flow.install`,
  activate: `${DOCS_BASE}/t/flow.activate`,
  connectRegister: `${DOCS_BASE}/t/flow.connect-register`,
  mobileSetup: `${DOCS_BASE}/t/flow.mobile`,
  troubleshooting: `${DOCS_BASE}/t/service.troubleshooting`,
  updates: `${DOCS_BASE}/t/service.install`,
  releaseNotes: `${DOCS_BASE}/t/release.latest`,
  glossary: `${DOCS_BASE}/t/ref.glossary`,
  errors: `${DOCS_BASE}/t/site.errors`
} as const;
