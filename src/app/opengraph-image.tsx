import { OG_SIZE, ogCard } from "@/components/OgCard";
import { SITE } from "@/lib/site";

/** The site-wide share card. */
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogCard({
    headline: "Know what you make on every item in the store.",
    subline: "Price book, supplier costs and register sales on your back-office PC. Works with Verifone Commander.",
    screenshot: "screenshots/desktop-dashboard.png"
  });
}
