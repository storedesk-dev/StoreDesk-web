import type { Metadata } from "next";
import { AboutClient } from "./AboutClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://store-desk-prod.vercel.app";

export const metadata: Metadata = {
  title: "Why we built StoreDesk — for convenience store operators",
  description:
    "Learn about StoreDesk, built for convenience store and gas station operators. Local-first StoreDesk Worker, Desktop app, and StoreDesk Mobile scanner.",
  keywords: [
    "About StoreDesk",
    "StoreDesk team",
    "convenience store software",
    "c-store price book software"
  ],
  alternates: {
    canonical: `${siteUrl}/about`
  },
  openGraph: {
    title: "Why we built StoreDesk — for convenience store operators",
    description:
      "StoreDesk was built for convenience store operators to manage Price Books, track vendor costs, and sync with Verifone Commander.",
    url: `${siteUrl}/about`,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.png`, width: 1200, height: 400, alt: "About StoreDesk" }]
  }
};

export default function AboutPage() {
  return <AboutClient />;
}

