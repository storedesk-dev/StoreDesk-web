import type { Metadata } from "next";
import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const mono = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://storedesk.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StoreDesk — Worker, Desktop & Mobile for c-stores",
    template: "%s · StoreDesk"
  },
  description:
    "Run StoreDesk Worker on your backoffice PC with Desktop and Mobile. Price Book, Cost Analysis, POS Reports, and invoice review for Verifone Commander stores.",
  applicationName: "StoreDesk",
  keywords: [
    "StoreDesk",
    "Verifone Commander",
    "convenience store",
    "price book",
    "vendor cost",
    "c-store POS",
    "backoffice"
  ],
  authors: [{ name: "storedesk-dev" }],
  creator: "storedesk-dev",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "StoreDesk",
    title: "StoreDesk — Worker, Desktop & Mobile for c-stores",
    description:
      "Worker on the store PC, Electron desktop, StoreDesk Mobile. Price Book, costs, POS reports, invoices. Works with Verifone Commander.",
    images: [{ url: "/brand/logo-lockup-horizontal.jpg", width: 1200, height: 400, alt: "StoreDesk" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "StoreDesk",
    description: "Worker, Desktop, and Mobile on your backoffice PC. Works with Verifone Commander.",
    images: ["/brand/logo-lockup-horizontal.jpg"]
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/logo-mark.jpg", type: "image/jpeg" }
    ],
    apple: [{ url: "/brand/logo-mark.jpg", type: "image/jpeg" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
