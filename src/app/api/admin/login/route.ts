import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  authenticateInternalAdminLogin,
  createAdminSession,
  revokeSession
} from "@/lib/admin-auth";
import { ControlPlaneError } from "@/lib/control-plane-security";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const admin = await authenticateInternalAdminLogin(body.email, body.password);
    const session = await createAdminSession(String(admin.adminId));
    const res = NextResponse.json({
      ok: true,
      admin: { adminId: admin.adminId, email: admin.email }
    });
    res.cookies.set(ADMIN_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt
    });
    return res;
  } catch (error) {
    const status = error instanceof ControlPlaneError ? error.status : 503;
    const message = error instanceof Error ? error.message : "Login unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(ADMIN_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
