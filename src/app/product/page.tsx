import type { Metadata } from "next";
import { ProductClient } from "./ProductClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://storedesk.dev";

export const metadata: Metadata = {
  title: "Everything at the counter built for real store operations",
  description:
    "Explore StoreDesk features: Price Book management, supplier cost comparison, invoice extraction review, StoreDesk Mobile scanning app, and Verifone Commander sync.",
  keywords: [
    "StoreDesk features",
    "StoreDesk Price Book",
    "StoreDesk Mobile",
    "StoreDesk Worker",
    "Verifone Commander backoffice",
    "convenience store price book",
    "vendor cost analysis",
    "c-store barcode scanning"
  ],
  alternates: {
    canonical: `${siteUrl}/product`
  },
  openGraph: {
    title: "Everything at the counter built for real store operations",
    description:
      "Price Book, Cost & Profit Analysis, Invoice Review, Store Reports, StoreDesk Mobile scanning app, and Verifone Commander sync.",
    url: `${siteUrl}/product`,
    images: [{ url: `${siteUrl}/brand/logo-lockup-horizontal.png`, width: 1200, height: 400, alt: "StoreDesk Product Features" }]
  }
};

export default function ProductPage() {
  return <ProductClient />;
}

