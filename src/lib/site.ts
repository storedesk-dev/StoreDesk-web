/**
 * Facts about the product, in one place.
 *
 * Everything here is checked against the code it describes. Plan limits come
 * from `createSubscription`, the session length from `CLIENT_SESSION_TTL_SECONDS`,
 * the setup-key window from `issueSetupKeyEmail`. If one of those changes, this
 * changes with it — marketing copy that drifts from the product is worse than
 * no copy.
 */

export const SITE = {
  name: "StoreDesk",
  email: "hello@storedesk.net",
  supportEmail: "support@storedesk.net",
  domain: "storedesk.net",
  tagline: "Back-office software for convenience stores and gas stations",
  /** One sentence, used as the meta description and the hero subhead. */
  summary:
    "StoreDesk runs on the PC in your back office, reads prices straight from your Verifone Commander, and keeps working when the internet does not."
} as const;

/** What the product actually does, drawn from the shipped feature set. */
export const CAPABILITIES = {
  /** store-desk-worker/src/routes/priceBook.routes.ts */
  priceBook: "Every PLU from the register, searchable, with your vendor costs beside each one",
  /** catalog.repository.getPriceComparison */
  vendorCosts: "Every supplier's price on the same item, cheapest first",
  /** posReports.routes.ts + transSetParse.service.ts */
  posReports: "Daily, shift and monthly sales pulled from the register",
  /** modules/pos/utils/st3XmlExport.ts */
  salesTax: "Georgia ST-3 sales tax returns generated as filing-ready XML",
  /** integrations/google/* */
  sheets: "Daily sales written to a Google Sheet you own",
  /** store-desk-mobile scanner + price_book */
  scanner: "Scan a barcode on the shop floor and see cost, price and margin"
} as const;

/** Real limits from the control plane, not aspirational ones. */
export const PLANS = {
  trialDays: 30,
  standardDays: 365,
  defaultMaxStores: 5,
  defaultMaxWorkers: 5,
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

export const NAV = [
  { href: "/product", label: "What it does" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "Why we built it" },
  { href: "/contact", label: "Contact" }
] as const;
