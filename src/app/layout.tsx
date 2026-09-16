import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastContext";
import { ReleaseProvider } from "@/components/ReleaseContext";
import { fetchLatestRelease, type LatestRelease } from "@/lib/release";
import { jsonLdScript } from "@/lib/json-ld";
import { CAPABILITIES, DOCS_BASE, SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/metadata";

/*
 * Type system.
 *
 * Plus Jakarta Sans for everything people read: sturdy at 800 for headings,
 * even and dark at 400-500 for body copy. One family keeps the pages calm;
 * the first attempt paired a quirky display face with a light body and read
 * as both "funky" and thin. JetBrains Mono is kept for code only — prices use
 * tabular figures from the sans (`.sd-num`).
 */
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
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

/**
 * Structured data. The software entry carries the version that is actually published, its release
 * notes and the real installer URL, so a search engine's "StoreDesk 0.0.7" is the same thing the
 * download button gives you. `release` is null when the downloads site could not be read; the
 * version-specific fields are then simply absent rather than stale.
 */
function jsonLdFor(release: LatestRelease | null) {
  return {
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
        "creator": { "@type": "Organization", "name": "StoreDesk" },
        ...(release
          ? {
              softwareVersion: release.version,
              releaseNotes: release.notesUrl,
              ...(release.releaseDate ? { datePublished: release.releaseDate } : {}),
              ...(release.windows ? { installUrl: release.windows.url, fileSize: `${release.windows.size}` } : {})
            }
          : {}),
        "softwareHelp": { "@type": "CreativeWork", "url": DOCS_BASE }
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
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // One read for the whole site. The fetch itself is cached for an hour (lib/release.ts), so this
  // does not make any page dynamic that was not already.
  const release = await fetchLatestRelease();
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLdFor(release)) }}
        />
      </head>
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ReleaseProvider release={release}>
          <ToastProvider>{children}</ToastProvider>
        </ReleaseProvider>
      </body>
    </html>
  );
}

