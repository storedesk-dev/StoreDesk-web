import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://store-desk-prod.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/product",
    "/how-it-works",
    "/about",
    "/download",
    "/contact",
    "/privacy",
    "/terms"
  ];

  const now = new Date();

  return routes.map((route) => {
    let priority = 0.7;
    let changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" = "weekly";

    if (route === "") {
      priority = 1.0;
      changeFrequency = "daily";
    } else if (route === "/product" || route === "/how-it-works") {
      priority = 0.9;
      changeFrequency = "weekly";
    } else if (route === "/download") {
      priority = 0.85;
      changeFrequency = "weekly";
    } else if (route === "/about" || route === "/contact") {
      priority = 0.8;
      changeFrequency = "monthly";
    }

    return {
      url: `${siteUrl}${route}`,
      lastModified: now,
      changeFrequency,
      priority
    };
  });
}
