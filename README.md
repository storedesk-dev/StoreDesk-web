# StoreDesk Web

The public site (storedesk.net) and the **control plane**: the admin console where StoreDesk staff create
stores (the tenant, D-22), grant each store its one licence (D-23), and manage roles and users, and the API store servers call to activate and to
pull who may sign in. No store data lives here — catalog, price book and register history stay on the
store PC.

Repo: `https://github.com/storedesk-dev/StoreDesk-web`

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- MongoDB (Atlas) through Mongoose — `src/models/ControlPlane.ts`
- zod for every request body; argon2id for secrets; vitest with an in-memory MongoDB

## Run it

```bash
npm install
npm run dev:local     # throwaway database with sample data — no .env.local needed
```

`dev:local` starts an in-memory MongoDB replica set, seeds one staff login and five stores under two business
names (internal records; nothing is scoped by them): **Example Retail**'s Stores 42 (fuel, lottery, Google
Sheets on), 17 and 88, each with its own licence, the four template roles, a managed login, an invited user and
a waiting setup key; and **Corner Mart Group**'s Store 5 with its own licence and Store 6 Unlicensed. It prints the logins and each store's license, and runs `next dev`. Open `http://localhost:3000/admin`. Cloudflare and e-mail are
turned off for the run (stores show the tunnel as *not configured*); the data is gone when you stop it.
Set `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `DEV_USER_PASSWORD` or `PORT` to choose them. The first run
downloads a MongoDB binary once (to `~/.cache/mongodb-binaries`).

Against a real database: copy `.env.example` to `.env.local`, fill it in, and `npm run dev`.

## Checks

```bash
npm run lint && npx tsc --noEmit && npm test
npx next build
```

Route tests run each file against its own in-memory MongoDB replica set (`src/tests/helpers/mongo.ts`).

## Environment

See `.env.example` for the full list with notes.

| Variable | Needed for |
|---|---|
| `MONGODB_URI` | Everything (Atlas; a replica set, for transactions) |
| `SUPPORT_ADMIN_EMAIL`, `SUPPORT_ADMIN_PASSWORD` | The first staff sign-in at `/admin-gate` |
| `STORE_SECRET_KEY` | Storing the register (Commander) password and a readable copy of each store's reusable setup key, encrypted; 32+ characters |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_TUNNEL_DOMAIN` | Creating each store's tunnel (optional; stores then show *not configured*) |
| `RESEND_API_KEY`, `SETUP_EMAIL_FROM` | E-mailing setup keys and invitations (optional; otherwise shown once to the admin) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Sheets: the StoreDesk service account key, raw JSON or base64 (optional). The admin only switches Sheets on per store; the sheet is connected in the desktop app and reached through the store-scoped proxy |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL in metadata (optional) |

## What is where

- `docs/design/control-plane-admin.md` (parent repo) — the contract for the admin console and its API.
- `docs/design/store-sign-in-and-sync.md` — how stores receive access (`GET /api/v1/edge/sync/access`)
  and how the control plane nudges them.
- `src/app/admin/**` — the admin console; `src/app/admin-gate` — staff sign-in.
- `src/app/api/v1/admin/**` — admin API (staff session cookie). Every change is audited; every change that
  reaches a store notifies it.
- `src/app/api/v1/edge/**`, `src/app/api/v1/setup-keys/redeem`, `…/worker-installations/*/bootstrap*` —
  store-server API (worker credential, or the setup key).
- `src/app/api/v1/app-auth/sign-in` — the phone's e-mail sign-in and store list (D-18).
- `src/app/api/v1/app-auth/organizations/{slug}` — the legacy org-tag lookup, kept only until phones older than
  0.0.9 are gone.
- `src/app/api/v1/lottery/*` — StoreDesk Lottery's sign-in, bind, token, roster, sign-out and unbind (D-26).
- `src/lib/` — one module per area: `organizations` (the internal business record a store still carries),
  `licenses` (one licence per store, granted by staff; no trial), `migrations` (run once per process on connect),
  `lottery-pc` and `lottery-refresh` (the lottery PC and its per-person credentials),
  `tenant-stores` (stores and settings), `setup` (setup keys, Replace PC), `store-setup-key` (the reusable
  key: reveal, rotate, the PC reading its key and releasing its installation), `users`, `roles`,
  `role-templates`, `admin-views` (dashboard, audit, access preview), `access-sync`, `store-notify`,
  `google`, `tunnel`, `http` (errors and body parsing), `audit`.
- `src/config/pages.ts` — generated page registry; never edit it (regenerate from the parent repo).

Errors are always `{error: {code, message, correlationId, retryable}}`. Secrets never appear in a response:
tunnel tokens, worker credentials, relay keys, password hashes and the register password are scrubbed or
never selected; the one exception is the store server's own access sync (password hashes of its users).

## Brand

Assets under `public/brand/` from the parent `brand-kit/` (`#1A63F4` / `#00A87B`).
