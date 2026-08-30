import type { Metadata } from "next";
import { ContactClient } from "./ContactClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://store-desk-prod.vercel.app";

export const metadata: Metadata = {
  title: "Contact StoreDesk Support & Team",
  description:
    "Contact the StoreDesk team for assistance with StoreDesk Worker setup, Desktop dashboard, StoreDesk Mobile scanning app, or Verifone Commander integration.",
  keywords: [
    "Contact StoreDesk",
    "StoreDesk support",
    "convenience store software support",
    "StoreDesk help"
  ],
  alternates: {
    canonical: `${siteUrl}/contact`
  },
  openGraph: {
    title: "Contact StoreDesk Support & Team",
    description:
      "Get help setting up StoreDesk Worker, Desktop app, or StoreDesk Mobile scanner for your convenience store or gas station.",
    url: `${siteUrl}/contact`,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.png`, width: 1200, height: 400, alt: "Contact StoreDesk Team" }]
  }
};

export default function ContactPage() {
  return <ContactClient />;
}

