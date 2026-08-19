# store-desk-web/ — Agent map

Parent: root `AGENTS.md`. Remote: `https://github.com/storedesk-dev/StoreDesk-web.git`

## Purpose

StoreDesk Web — Next.js marketing site, SEO search engine portal, and Atlas-backed store license control plane.

## Owners

`docs-scribe` + web implementer; later Hub work stays out of this repo until WO opens.

## Key Features & SEO Architecture

- **SEO System**: Next.js 15 App Router dynamic sitemap (`src/app/sitemap.ts`), `robots.txt` (`src/app/robots.ts`), and route-level server component metadata.
- **Structured Data**: Schema.org JSON-LD graph (`SoftwareApplication`, `Organization`, `WebSite`) in `src/app/layout.tsx`.
- **Target Keywords**: `StoreDesk`, `StoreDesk Worker`, `StoreDesk Mobile`, `StoreDesk Desktop`, `StoreDesk Web`, `c-store price book`, `Verifone Commander backoffice`, `vendor cost comparison`.
- **Pages & Routes**: `/` (Home), `/product` (Features & Verifone Sync), `/how-it-works` (Architecture), `/about` (Mission), `/contact` (Support), `/privacy`, `/terms`.

## Rules

- Atlas holds licenses / registry only — not catalog or Commander data.
- Prefer StoreDesk Mobile naming (not Buddy).
- Brand tokens from parent `brand-kit/`.
