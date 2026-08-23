import type { Metadata } from "next";
import { ProductClient } from "./ProductClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://store-desk-prod.vercel.app";

export const metadata: Metadata = {
  title: "StoreDesk Features — Price Book, Vendor Cost Comparison & Mobile Scanner",
  description:
    "Explore StoreDesk features: Price Book management, vendor cost comparison, multi-pack math, pricing rules, and StoreDesk Mobile barcode scanner. Built for Verifone Commander stores.",
  keywords: [
    "StoreDesk features",
    "StoreDesk Price Book",
    "StoreDesk Mobile",
    "StoreDesk Worker",
    "Verifone Commander backoffice",
    "convenience store price book",
    "vendor cost comparison",
    "c-store barcode scanning",
    "margin tracking c-store"
  ],
  alternates: {
    canonical: `${siteUrl}/product`
  },
  openGraph: {
    title: "StoreDesk Features — Price Book, Vendor Cost & Mobile Scanner",
    description:
      "Price Book management, vendor cost comparison, margin & markup pricing rules, and StoreDesk Mobile barcode scanner for convenience stores.",
    url: `${siteUrl}/product`,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.jpg`, width: 1200, height: 400, alt: "StoreDesk Product Features" }]
  }
};

export default function ProductPage() {
  return <ProductClient />;
}
