import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getAdminPassword,
  passwordsMatch,
  sessionTokenFor
} from "@/lib/admin-auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = getAdminPassword();
  if (!expected) {
    return NextResponse.json(
      { error: "Admin password not configured (set MONGODB_URI or ADMIN_PASSWORD)" },
      { status: 503 }
    );
  }
  if (!passwordsMatch(body.password ?? "", expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await sessionTokenFor(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
