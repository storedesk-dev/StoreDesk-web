import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL 
  ? process.env.NEXT_PUBLIC_SITE_URL 
  : process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";

export const metadata: Metadata = {
  title: "StoreDesk — Local-First C-Store Backoffice & Price Book",
  description:
    "StoreDesk — Run StoreDesk Worker on your store computer with Desktop and Mobile. Price Book, Vendor Cost Comparison, POS Reports, and Verifone Commander sync.",
  keywords: [
    "StoreDesk",
    "StoreDesk Worker",
    "StoreDesk Mobile",
    "StoreDesk Desktop",
    "c-store backoffice",
    "convenience store price book",
    "gas station software"
  ],
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    title: "StoreDesk — Local-First C-Store Backoffice & Price Book",
    description:
      "StoreDesk by Trupal: StoreDesk Worker on store PC, Electron desktop app, and StoreDesk Mobile scanner. Works with Verifone Commander.",
    url: siteUrl,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.png`, width: 1200, height: 400, alt: "StoreDesk" }]
  }
};

export default function HomePage() {
  return <LandingPage />;
}

