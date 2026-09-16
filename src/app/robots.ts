import type { MetadataRoute } from "next";
import { SITE_URL as siteUrl } from "@/lib/metadata";
import { SITE } from "@/lib/site";

/**
 * Everything a visitor can reach is crawlable; everything that needs a sign-in, or that carries a
 * credential in the URL, is not.
 *
 * `/enroll` stays out because it is where somebody redeems a one-time code: indexing it is no help
 * to anyone and an indexed page with a code in the query string would be a leak. The admin console
 * and the API are behind auth anyway, but saying so keeps them out of the crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/admin-gate", "/api/", "/enroll"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // The crawlers that read llms.txt are told the same thing, explicitly, so a change to the
      // wildcard rule above never quietly narrows what they may read.
      { userAgent: ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended"], allow: "/", disallow }
    ],
    // The directive takes a bare hostname, not a URL.
    host: SITE.domain,
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
