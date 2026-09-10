import type { MetadataRoute } from "next";
import { SITE_URL as siteUrl } from "@/lib/metadata";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin-gate", "/api/", "/enroll"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
