# store-desk-web/ — Agent map

Parent: root `AGENTS.md` and `CLAUDE.md`. Remote: `https://github.com/storedesk-dev/StoreDesk-web.git`

## Purpose

StoreDesk Web — the Next.js marketing site and the **control plane**: organizations, licenses
(an organization license with seats, or a store's own license), stores (feature and integration switches, register,
PC and phones), roles, users and audit, plus the API store servers
use to activate and to pull access. Contract: `docs/design/control-plane-admin.md` and
`docs/design/store-sign-in-and-sync.md` in the parent repo.

## Rules

- **No store data.** MongoDB holds the control plane only — never catalog, price book or register history.
- **Every admin mutation writes an audit event** (`lib/audit.ts`, actions like `store.settings.update`).
- **Every change that reaches a store notifies it** (`scheduleNotify` / `scheduleAppUserNotify` in
  `lib/store-notify.ts`); the store then pulls `GET /api/v1/edge/sync/access`.
- **Validate every body with zod** (`parseBody` in `lib/http.ts`) and answer errors through `jsonError`:
  `{error:{code,message,…}}`; a duplicate is 409, a bad value 400 — never 503 for a client mistake.
- **No secret in a response.** `safeJson()` scrubs secret-named fields; `passwordHash` is selected
  (`+passwordHash`) only in `lib/access-sync.ts`, `lib/control-plane.ts` and `lib/admin-auth.ts`
  (a test enforces this). The register password is write-only.
- **configJson is server-built** (register connection only). Roles reach stores only through the access sync.
- **An existing login is never modified by "add user"** — password changes are their own audited route.
- `src/config/pages.ts` is generated from `shared/pages-registry.ts`; never hand-edit it.
- Prefer StoreDesk Mobile naming (not Buddy). Brand tokens from the parent `brand-kit/`.

## Agent Directives

**Stack:** Next.js 15 App Router + React + TypeScript + Mongoose + zod.

**Verify:** `npm run lint && npx tsc --noEmit && npm test`, then `npx next build`.
Run locally with `npm run dev:local` (in-memory MongoDB, sample data, logins printed).

**Tests:** route and library tests call the route handlers directly against an in-memory MongoDB replica
set — `setupMemoryMongo()` from `src/tests/helpers/mongo.ts`, request helpers in `src/tests/helpers/api.ts`.
Mock `@/lib/store-notify` (to assert notifies) and `@/lib/cloudflare`.

**Release rule:** Update `LATEST_RELEASE_TAG` in `src/app/download/DownloadClient.tsx` before every release tag.

**Task discipline:** read `docs/` and this file before grepping; reuse existing helpers; plan → approve →
implement → verify → commit.

**Out of scope:** stock qty, inventory, reorder, warehouse.

## Layout

```txt
src
├── app
│   ├── (marketing pages)        about, contact, download, how-it-works, product, privacy, terms, enroll
│   ├── admin/                   admin console (organizations, stores, roles, users, activity)
│   ├── admin-gate/              staff sign-in
│   └── api
│       ├── admin/login          staff sign-in API (rate-limited, audited)
│       └── v1
│           ├── admin/           admin API (staff session)
│           ├── edge/            store-server API (worker credential): sync/access, sync/config,
│           │                    roles/{roleId}, google/sheets/{meta,values,append}
│           │                    (the store's own sheet only, while its switch is on)
│           ├── setup-keys/redeem   activation (setup key)
│           ├── organizations/…/worker-installations/…/bootstrap   store-server bootstrap
│           └── app-auth/        org-tag lookup and enrollment (public, rate-limited)
├── config/pages.ts              GENERATED page registry
├── lib/                         one module per area (see README "What is where")
├── models/ControlPlane.ts       every Mongoose model
├── middleware.ts                cookie presence check for /admin and /api/v1/admin
└── tests/                       vitest; helpers/ for the in-memory MongoDB
scripts/dev-local.ts             npm run dev:local
```
