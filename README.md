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

- Marketing home
- Create store → `STORE_ID` + `AGENT_KEY`
- Rotate agent key / suspend store
- Mock agents page (Hub later)

Not in this app: catalog, Commander, invoices (those stay on Edge / StoreDesk Server).
