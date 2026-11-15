import type { NextConfig } from "next";

/**
 * CORS: none.
 *
 * - The admin API (/api/v1/admin/*) and staff sign-in (/api/admin/*) are
 *   same-origin only. The old `Access-Control-Allow-Origin: *` with
 *   credentials on every /api route invited other sites to call them.
 * - The store server (edge routes, setup-key redeem, bootstrap) and the
 *   native desktop and phone apps are not browsers; CORS does not apply.
 * - The public org-tag lookup, the one route that allowed any origin, is gone:
 *   phones sign in by email (D-18).
 */
const nextConfig: NextConfig = {};

export default nextConfig;
