import type { NextConfig } from "next";

/**
 * CORS: none, except the public org-tag lookup.
 *
 * - The admin API (/api/v1/admin/*) and staff sign-in (/api/admin/*) are
 *   same-origin only. The old `Access-Control-Allow-Origin: *` with
 *   credentials on every /api route invited other sites to call them.
 * - The store server (edge routes, setup-key redeem, bootstrap) and the
 *   native desktop and phone apps are not browsers; CORS does not apply.
 * - The phone app also has a web build (store-desk-mobile/web) that may be
 *   served from another origin, and its first call is the public, read-only
 *   org-tag lookup. That one route allows any origin, GET only, no credentials.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/v1/app-auth/organizations/:slug",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET" }
        ]
      }
    ];
  }
};

export default nextConfig;
