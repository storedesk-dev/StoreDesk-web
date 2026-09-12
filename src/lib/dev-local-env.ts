/**
 * Variables `npm run dev:local` blanks before starting, so a throwaway local
 * run can never reach a real service with keys from .env.local: create a
 * Cloudflare tunnel, send e-mail, sign in with the production bootstrap
 * admin, or use StoreDesk's Google account. DEV_LOCAL_KEEP=A,B keeps some.
 */
export const DEV_LOCAL_BLANKED_ENV = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_ID",
  "RESEND_API_KEY",
  "SETUP_EMAIL_FROM",
  "SUPPORT_ADMIN_EMAIL",
  "SUPPORT_ADMIN_PASSWORD",
  "ADMIN_PASSWORD",
  "GOOGLE_SERVICE_ACCOUNT_JSON"
] as const;
