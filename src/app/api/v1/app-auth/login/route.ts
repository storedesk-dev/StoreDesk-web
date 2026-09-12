import { NextResponse } from "next/server";
import { jsonError, loginAppUser } from "@/lib/control-plane";

/**
 * LEGACY — no client calls this any more. Both apps sign in at the store
 * server (`POST /api/auth/v1/login`, docs/design/store-sign-in-and-sync.md);
 * the phone uses the control plane only for the org-tag lookup. Left working
 * until it is removed; do not build on it.
 */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
      deviceId?: string;
      organizationSlug?: unknown;
    };
    if (!body.email || !body.password || !body.audience) {
      return NextResponse.json({ error: "email, password, and audience are required" }, { status: 400 });
    }
    if (body.organizationSlug !== undefined && typeof body.organizationSlug !== "string") {
      return NextResponse.json({ error: "organizationSlug must be a string" }, { status: 400 });
    }
    const result = await loginAppUser({
      email: body.email,
      password: body.password,
      deviceName: body.deviceName,
      audience: body.audience,
      deviceId: body.deviceId,
      organizationSlug: body.organizationSlug
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
