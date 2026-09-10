import type { Metadata } from "next";
import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastContext";
import { SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/metadata";

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
    images: [
      {
        url: `${siteUrl}/brand/logo-lockup-horizontal.png`,
        width: 1200,
        height: 400,
        alt: "StoreDesk"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "StoreDesk — back-office software for convenience stores",
    description: SITE.summary,
    images: [`${siteUrl}/brand/logo-lockup-horizontal.png`]
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
      "operatingSystem": "Windows, macOS, Android",
      "description": SITE.summary,
      "creator": { "@type": "Organization", "name": "StoreDesk" }
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
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

