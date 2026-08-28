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

## Agent Directives

**Stack:** Next.js + React + TypeScript

**Release rule:** Update `LATEST_RELEASE_TAG` in `src/app/download/DownloadClient.tsx` before every release tag.

**Verify:** `npm run build` (type check + build)

**Task discipline:**
- Token bloat: reuse existing components and hooks before adding new ones.
- Read `docs/` + `AGENTS.md` before grepping.
- Plan → approve → implement → verify → commit. TDD applies.
- No code without human approval. No WO close without `qa-verifier` green.

**Out of scope:** stock qty, inventory, reorder, warehouse, cloud backend.

## Directory Structure

```txt
store-desk-web/src
├── app
│   ├── about
│   │   ├── AboutClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── admin
│   │   ├── agents
│   │   ├── audit
│   │   ├── layout.tsx
│   │   ├── organizations
│   │   ├── page.tsx
│   │   ├── setup-keys
│   │   └── users
│   ├── admin-gate
│   │   ├── AdminGateClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api
│   │   ├── admin
│   │   ├── auth
│   │   ├── stores
│   │   └── v1
│   ├── apple-icon.jpg
│   ├── contact
│   │   ├── ContactClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── download
│   │   ├── DownloadClient.tsx
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── how-it-works
│   │   ├── HowItWorksClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── icon.jpg
│   ├── layout.tsx
│   ├── page.tsx
│   ├── privacy
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── product
│   │   ├── ProductClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── robots.ts
│   ├── sitemap.ts
│   └── terms
│       ├── layout.tsx
│       └── page.tsx
├── components
│   ├── DeviceStage.tsx
│   ├── LandingPage.tsx
│   ├── MarketingShell.tsx
│   ├── MermaidDiagram.tsx
│   ├── SiteChrome.tsx
│   ├── VendorCostChart.tsx
│   └── VerifoneBadge.tsx
├── lib
│   ├── admin-auth.ts
│   ├── cloudflare.ts
│   ├── control-plane-security.ts
│   ├── control-plane.ts
│   ├── db.ts
│   ├── email-provider.ts
│   ├── mongodb.js
│   ├── site.ts
│   └── stores.ts
├── middleware.ts
├── models
│   ├── ControlPlane.ts
│   └── Store.ts
└── tests
    └── control-plane-security.test.ts

25 directories, 51 files
```
