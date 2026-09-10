import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastContext";
import { CAPABILITIES, SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/metadata";

/*
 * Type system.
 *
 * Figtree for reading: open apertures and a tall x-height keep 16–18px body
 * copy easy on a back-office monitor. Bricolage Grotesque for headings: a
 * grotesque with some ink-trap character, so a page title reads as a brand
 * rather than a form label. JetBrains Mono for PLUs, prices and margins, where
 * digits have to line up.
 */
const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap"
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap"
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap"
});

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StoreDesk — back-office software for convenience stores",
    template: "%s · StoreDesk"
  },
  description: SITE.summary,
  applicationName: "StoreDesk",
  // No keywords array. Search engines have ignored the meta keywords tag for
  // over a decade, and the previous list read as keyword stuffing to anyone who
  // viewed source.
  authors: [{ name: "StoreDesk" }],
  publisher: "StoreDesk",
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "StoreDesk",
    title: "StoreDesk — back-office software for convenience stores",
    description: SITE.summary,
  },
  twitter: {
    card: "summary_large_image",
    title: "StoreDesk — back-office software for convenience stores",
    description: SITE.summary
  },
  verification: {
    google: "ELm9u6dJOxQAaNx5-2-a8-u1wsPVVsjgEBJD9TDN3Jw"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
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
      "operatingSystem": "Windows 10 or later, Android 5.0 or later",
      "downloadUrl": `${siteUrl}/download`,
      "url": siteUrl,
      "image": `${siteUrl}/brand/logo-mark.png`,
      "featureList": Object.values(CAPABILITIES),
      "description": SITE.summary,
      "creator": { "@type": "Organization", "name": "StoreDesk" }
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      "name": "StoreDesk",
      "url": siteUrl,
      "logo": `${siteUrl}/brand/logo-mark.png`,
      "email": SITE.email,
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": SITE.supportEmail,
        "availableLanguage": "English"
      }
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      "url": siteUrl,
      "name": "StoreDesk",
      "description": SITE.summary,
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
      <body className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

