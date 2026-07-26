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

## Env (`.env.local`)

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `MONGODB_URI` | Yes for Atlas | Store license DB. Also supplies admin password if `ADMIN_PASSWORD` unset. |
| `ADMIN_PASSWORD` | No | Override admin gate password (defaults to URI password). |

Example:

```txt
MONGODB_URI=mongodb+srv://storedeskdev_db_user:****@storedesk.friyqcp.mongodb.net/storedesk?retryWrites=true&w=majority&appName=StoreDesk
```
