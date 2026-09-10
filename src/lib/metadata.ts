import type { Metadata } from "next";
import { SITE } from "@/lib/site";

/**
 * The one canonical origin.
 *
 * Pages previously each carried their own fallback — `store-desk-prod.vercel.app`
 * on some, `storedesk.dev` on another, `localhost` on the home page — so the site
 * disagreed with itself about its own canonical address, which splits search
 * ranking across duplicates.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? `https://${SITE.domain}`).replace(/\/$/, "");

/**
 * Consistent per-page metadata.
 *
 * No `keywords`: search engines have ignored the tag for over a decade, and the
 * lists that used to sit on every page read as stuffing to anyone viewing source.
 * The description is what search results actually show, so it is written as a
 * sentence a store owner would want to click, not a list of product names.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  /** Home page only: use the title as-is instead of the "· StoreDesk" template. */
  absoluteTitle?: boolean;
}): Metadata {
  const url = input.path === "/" ? SITE_URL : `${SITE_URL}${input.path}`;
  const image = {
    url: `${SITE_URL}/brand/logo-lockup-horizontal.png`,
    width: 1200,
    height: 400,
    alt: "StoreDesk"
  };

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE.name,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image.url]
    }
  };
}
