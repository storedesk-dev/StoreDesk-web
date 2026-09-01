import type { Metadata } from "next";
import { HowItWorksClient } from "./HowItWorksClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://storedesk.dev";

export const metadata: Metadata = {
  title: "How StoreDesk powers your store",
  description:
    "Discover how StoreDesk powers your convenience store: StoreDesk Worker on store computer, Desktop admin dashboard, and StoreDesk Mobile scanner on store Wi-Fi.",
  keywords: [
    "How StoreDesk works",
    "StoreDesk architecture",
    "StoreDesk Worker",
    "StoreDesk Desktop",
    "StoreDesk Mobile",
    "local-first c-store software",
    "c-store POS network setup"
  ],
  alternates: {
    canonical: `${siteUrl}/how-it-works`
  },
  openGraph: {
    title: "How StoreDesk powers your store",
    description:
      "Store Engine on store PC, Desktop management, and Mobile floor scanning over store Wi-Fi. Local, fast, and private.",
    url: `${siteUrl}/how-it-works`,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.png`, width: 1200, height: 400, alt: "StoreDesk System Map & Architecture" }]
  }
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}

