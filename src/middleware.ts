import { NextRequest, NextResponse } from "next/server";

export const ADMIN_COOKIE = "sd_session";

function isValidAdminCookie(cookieValue: string | undefined): boolean {
  return Boolean(cookieValue?.startsWith("ses_") && cookieValue.includes("."));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname.startsWith("/api/stores") || pathname.startsWith("/api/v1/admin")) {
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  matcher: ["/admin/:path*", "/api/stores/:path*", "/api/v1/admin/:path*"]
};
