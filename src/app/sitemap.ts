import type { MetadataRoute } from "next";
import { SITE_URL as siteUrl } from "@/lib/metadata";
import { fetchLatestRelease } from "@/lib/release";

/**
 * Every page a visitor can reach. `/enroll`, `/admin` and the API are left out on purpose; robots.ts
 * disallows them too.
 *
 * `lastModified` used to be "now" for every page on every build, which tells a crawler nothing. The
 * download page's real date is the day the current version was published, so that is what it gets.
 */
export const revalidate = 3600;

const ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/product", priority: 0.9, changeFrequency: "monthly" },
  { path: "/how-it-works", priority: 0.9, changeFrequency: "monthly" },
  { path: "/download", priority: 0.85, changeFrequency: "weekly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.4, changeFrequency: "yearly" }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const release = await fetchLatestRelease();
  const released = release?.releaseDate ? new Date(release.releaseDate) : null;
  const published = released && !Number.isNaN(released.getTime()) ? released : new Date();

  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    lastModified: path === "/download" ? published : new Date(),
    changeFrequency,
    priority
  }));
}
