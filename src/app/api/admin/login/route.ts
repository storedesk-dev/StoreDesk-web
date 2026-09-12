import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminCookieName,
  adminCookieOptions,
  authenticateInternalAdminLogin,
  createAdminSession,
  readAdminToken,
  requireInternalAdmin,
  revokeSession
} from "@/lib/admin-auth";
import { callerIp } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";

const LoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").max(254),
  password: z.string().min(1, "Password is required").max(500)
});

/**
 * Staff sign-in. At most 10 attempts per address and 5 per e-mail in 15
 * minutes, counted in MongoDB (429 LOGIN_RATE_LIMITED); every attempt is
 * audited. The middleware refuses a sign-in not sent by the admin console.
 */
export async function POST(req: Request) {
  try {
    const body = await parseBody(req, LoginSchema);
    const admin = await authenticateInternalAdminLogin(body.email, body.password, callerIp(req));
    const session = await createAdminSession(String(admin.adminId));
    const res = NextResponse.json({
      ok: true,
      admin: { adminId: String(admin.adminId), email: String(admin.email), name: String(admin.name) }
    });
    res.cookies.set(adminCookieName(), session.token, adminCookieOptions(session.expiresAt));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}

/** The signed-in staff member, or 401. */
export async function GET(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    return NextResponse.json({ admin });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    await revokeSession(await readAdminToken(req));
  } catch {
    /* signing out always clears the cookie */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), "", adminCookieOptions());
  return res;
}
