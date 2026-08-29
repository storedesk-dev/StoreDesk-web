# StoreDesk Web

Next.js (App Router) product site + store license admin for StoreDesk.

Repo: `https://github.com/storedesk-dev/StoreDesk-web`

## Stack

- Next.js 15 + TypeScript + Tailwind
- MongoDB Atlas via `MONGODB_URI` (optional — memory fallback for local UI)

## Scripts

```bash
npm install
npm run dev
```

Open `http://localhost:3000` (marketing) and `/admin` (licenses).

## Env

Copy `.env.example` → `.env.local`:

```txt
MONGODB_URI=mongodb+srv://...
ADMIN_TOKEN=dev-admin
```

Without `MONGODB_URI`, stores live in process memory (resets on restart).

## Brand

Assets under `public/brand/` from parent `brand-kit/` (`#1A63F4` / `#00A87B`).

## Scope

- Marketing site: Product, How it works, About, Contact (`storedesk.dev@gmail.com`), Privacy, Terms
- Direct `/admin` → password gate (Atlas DB password)
- Licenses: trial / standard / custom with **supportEndsAt** + double confirm (`CONFIRM` + checkbox + dialog)
- Rotate agent key / suspend store
- Mock agents page (Hub later)

## Env (`.env.local` / Vercel)

The Control Plane requires 10 environment variables in production.

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string. |
| `SUPPORT_ADMIN_EMAIL` | Email for root admin login at `/admin-gate`. |
| `SUPPORT_ADMIN_PASSWORD` | Password for root admin login. |
| `RELAY_SESSION_SECRET` | 32+ char random string for signing JWT tokens. |
| `RELAY_KEY_ID` | Identifier for the secret (e.g., `key-v1`). |
| `CONTROL_PLANE_ISSUER` | Domain name of the control plane (e.g., `storedesk.net`). |
| `CLOUDFLARE_API_TOKEN` | Token to provision Zero Trust tunnels. |
| `CLOUDFLARE_ACCOUNT_ID` | CF Account ID. |
| `CLOUDFLARE_ZONE_ID` | CF Zone ID for the tunnel domain. |
| `CLOUDFLARE_TUNNEL_DOMAIN` | Domain for tunnels (e.g., `storedesk.net`). |

*Note: Setup Keys (for Worker Installation) are no longer emailed. The `/admin` panel API will return the plaintext `setupKey` in its JSON response for manual distribution.*
