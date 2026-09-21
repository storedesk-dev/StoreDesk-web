/**
 * StoreDesk and StoreDesk Lottery are separate products that happen to share a control plane.
 *
 * A store may run either, both or neither. Their installations live in the same collection but must
 * never be confused: a lottery PC does not count against StoreDesk's PC allowance, does not block a
 * StoreDesk activation, and is not what the phone means when it asks whether a store is "set up".
 *
 * Installations written before the lottery app existed carry no `product`, so every filter here
 * treats a missing value as StoreDesk.
 */

export const PRODUCTS = ["storedesk", "lottery"] as const;
export type Product = (typeof PRODUCTS)[number];

export const STOREDESK: Product = "storedesk";
export const LOTTERY: Product = "lottery";

/** Read an installation's product, defaulting the rows that predate the field. */
export function productOf(installation: { product?: unknown } | null | undefined): Product {
  return installation?.product === LOTTERY ? LOTTERY : STOREDESK;
}

/**
 * The Mongo filter for one product. StoreDesk has to match the older rows too, which have no
 * `product` at all — hence the `$in` with null and the `$exists: false`.
 */
export function productFilter(product: Product): Record<string, unknown> {
  return product === LOTTERY
    ? { product: LOTTERY }
    : { $or: [{ product: STOREDESK }, { product: { $exists: false } }, { product: null }] };
}
