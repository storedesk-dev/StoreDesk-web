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
  deals: "Multi-buy deals from the register, with what each one is really making (changed on the register itself for now)",
  /** priceBook.priceGroups feature flag */
  priceGroups: "Group items and change price and information across the whole group at once",
  /** registerChanges + settings.registerWrites */
  registerChanges: "Change an item's price or details and save it to the register, one item at a time, checked and read back",
  /** transactions + POS reports — Features/PosReports */
  posReports: "Daily, shift and monthly sales pulled from the register, down to single transactions",
  /** Features/SalesTax — StateRules.Supported is ["GA"] */
  salesTax: "Georgia ST-3 sales tax returns generated as filing-ready XML",
  /** Integrations/Google */
  sheets: "Daily sales written to a Google Sheet you own",
  /** mobileScanner + mobilePriceBook */
  scanner: "Scan a barcode on the shop floor and see cost, price and margin",
  /** userManagement — page key `userManagement`, "Users and Roles" */
  roles: "Staff accounts you create, and per-screen control over what each person opens",
  /** store-desk-lottery — StoreDesk Lottery, its own app on the lottery PC */
  lottery: "Instant-ticket rack, packs and shift close by scanner on the lottery PC, with the day's lottery cash sent to StoreDesk"
} as const;

/** Real limits from the control plane, not aspirational ones. */
export const PLANS = {
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

/**
 * The header. Four places an owner choosing software actually goes: what it does, the lottery app
 * (a separate buying decision), how setup goes, and who we are. Contact is the header's one button,
 * because a licence is granted by us, not bought online; Download and the guide sit beside it as
 * plain links for stores that already run StoreDesk.
 */
export const NAV = [
  { href: "/product", label: "Product" },
  { href: "/product/lottery", label: "Lottery" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" }
] as const;

/** The product section: the overview, then one page per app. Also the footer's first column. */
export const PRODUCT_NAV = [
  { href: "/product", label: "Overview", line: "All four apps, the register and the internet" },
  { href: "/product/desktop", label: "StoreDesk Desktop", line: "The back office on your Windows PC" },
  { href: "/product/mobile", label: "StoreDesk Mobile", line: "Prices, sales and scanning on Android" },
  { href: "/product/service", label: "StoreDesk Service", line: "Runs on the store PC and talks to the register" },
  { href: "/product/lottery", label: "StoreDesk Lottery", line: "The ticket rack and the shift close" }
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
  lottery: `${DOCS_BASE}/t/product.lottery`,
  activate: `${DOCS_BASE}/t/flow.activate`,
  connectRegister: `${DOCS_BASE}/t/flow.connect-register`,
  mobileSetup: `${DOCS_BASE}/t/flow.mobile`,
  troubleshooting: `${DOCS_BASE}/t/service.troubleshooting`,
  updates: `${DOCS_BASE}/t/service.install`,
  releaseNotes: `${DOCS_BASE}/t/release.latest`,
  glossary: `${DOCS_BASE}/t/ref.glossary`,
  errors: `${DOCS_BASE}/t/site.errors`
} as const;
