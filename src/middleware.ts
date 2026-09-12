import { NextRequest, NextResponse } from "next/server";

/**
 * The same name lib/admin-auth.ts uses (middleware runs on the edge runtime
 * and cannot import the Mongo-backed module).
 */
function adminCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-sd_session" : "sd_session";
}

function isValidAdminCookie(cookieValue: string | undefined): boolean {
  return Boolean(cookieValue?.startsWith("ses_") && cookieValue.includes("."));
}

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function refuse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** The admin console's origin: ADMIN_ORIGIN when set, else the origin this request was made to. */
export function adminOrigin(req: NextRequest): string {
  return process.env.ADMIN_ORIGIN?.trim().replace(/\/+$/, "") || req.nextUrl.origin;
}

/**
 * A request the admin console made itself. Store tunnels live on
 * *.tunnels.storedesk.net — the same *site* as storedesk.net — so SameSite
 * alone does not stop a page there from posting here; the browser-set Origin
 * and Sec-Fetch-Site headers (which a page cannot forge) do.
 */
function fromAdminConsole(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "same-origin") return true;
  const origin = req.headers.get("origin");
  return origin !== null && origin === adminOrigin(req);
}

function isJson(req: NextRequest): boolean {
  return (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const adminApi = pathname.startsWith("/api/v1/admin") || pathname.startsWith("/api/admin");

  // Every change to the admin API — staff sign-in and sign-out included —
  // must come from the admin console, as JSON (no form can send that).
  if (adminApi && MUTATIONS.has(req.method)) {
    if (!fromAdminConsole(req)) {
      return refuse(403, "CSRF_REJECTED", "This request didn't come from the StoreDesk admin console.");
    }
    if (!isJson(req)) {
      return refuse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request as application/json.");
    }
  }

  const authed = isValidAdminCookie(req.cookies.get(adminCookieName())?.value);

  if (pathname.startsWith("/api/stores") || pathname.startsWith("/api/v1/admin")) {
    if (!authed) {
      // The standard error shape every route answers with.
      return refuse(401, "UNAUTHORIZED", "Sign in again.");
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin-gate";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/stores/:path*", "/api/v1/admin/:path*", "/api/admin/:path*"]
};
