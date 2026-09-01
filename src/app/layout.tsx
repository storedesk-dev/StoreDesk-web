import type { Metadata } from "next";
import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastContext";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL 
  ? process.env.NEXT_PUBLIC_SITE_URL 
  : process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StoreDesk — Local-First C-Store Backoffice, Price Book & POS Integration",
    template: "%s | StoreDesk"
  },
  description:
    "StoreDesk — local-first convenience store and gas station backoffice software. Run StoreDesk Worker on your store PC with Desktop management and Mobile barcode scanning. Price Book, Vendor Cost tracking, and Verifone Commander sync.",
  applicationName: "StoreDesk",
  keywords: [
    "StoreDesk",
    "StoreDesk Trupal",
    "Trupal StoreDesk",
    "StoreDesk Worker",
    "StoreDesk Mobile",
    "StoreDesk Desktop",
    "StoreDesk Web",
    "StoreDesk Install",
    "StoreDesk Download",
    "StoreDesk setup",
    "c-store backoffice software",
    "convenience store price book",
    "gas station backoffice software",
    "Verifone Commander backoffice",
    "vendor cost comparison",
    "barcode scanning c-store",
    "convenience store software",
    "c-store inventory management price book"
  ],
  authors: [
    { name: "Trupal (StoreDesk)", url: siteUrl },
    { name: "StoreDesk Team", url: siteUrl }
  ],
  creator: "Trupal",
  publisher: "StoreDesk",
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "StoreDesk",
    title: "StoreDesk — Local-First C-Store Backoffice & Price Book Software",
    description:
      "StoreDesk: StoreDesk Worker on your store PC, Desktop management, and Mobile floor scanner. Price Book, vendor costs, POS reports, and Verifone Commander integration.",
    images: [
      {
        url: `${siteUrl}/brand/logo-lockup-horizontal.png`,
        width: 1200,
        height: 400,
        alt: "StoreDesk C-Store Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "StoreDesk — Local-First C-Store Backoffice Software",
    description:
      "StoreDesk: Worker on your store PC, Desktop dashboard, and Mobile floor scanner. Built for convenience stores & gas stations.",
    images: [`${siteUrl}/brand/logo-lockup-horizontal.png`]
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/logo-mark.png", type: "image/jpeg" }
    ],
    apple: [{ url: "/brand/logo-mark.png", type: "image/jpeg" }]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      "name": "StoreDesk",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Windows, macOS, Android",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description":
        "Local-first desktop, edge worker, and mobile backoffice platform for convenience stores and gas stations.",
      "author": {
        "@type": "Person",
        "name": "Trupal"
      },
      "creator": {
        "@type": "Organization",
        "name": "StoreDesk"
      }
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": "StoreDesk",
      "url": siteUrl,
      "logo": `${siteUrl}/brand/logo-mark.png`,
      "sameAs": []
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "StoreDesk",
      "description": "StoreDesk Web — C-Store Backoffice, Price Book & POS Integration",
      "publisher": {
        "@id": `${siteUrl}/#organization`
      }
    }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

