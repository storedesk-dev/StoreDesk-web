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
 * Consistent per-page metadata: title, description, canonical, Open Graph and the X card.
 *
 * No `keywords`: search engines have ignored the tag for over a decade. The description is what
 * search results show, so it is written as a sentence a store owner would want to click.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  /** Use the title as-is instead of the "· StoreDesk" template (titles that already name the product). */
  absoluteTitle?: boolean;
  /**
   * The share image's path. Defaults to the site-wide card (src/app/opengraph-image.tsx). Named
   * explicitly because a page-level `openGraph` object replaces the parent's wholesale.
   */
  image?: { path: string; alt: string };
}): Metadata {
  const url = input.path === "/" ? SITE_URL : `${SITE_URL}${input.path}`;
  const image = {
    url: `${SITE_URL}${input.image?.path ?? "/opengraph-image"}`,
    width: 1200,
    height: 630,
    alt: input.image?.alt ?? `${SITE.name}: ${SITE.tagline}`
  };

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
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

/** A `BreadcrumbList` graph node from the same trail the page shows. */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.path === "/" ? SITE_URL : `${SITE_URL}${crumb.path}`
    }))
  };
}
