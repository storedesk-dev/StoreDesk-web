import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, provisionAppUser } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { AppUserModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    await connectDb();
    const users = await AppUserModel.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ appUsers: safeJson(users) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    const body = (await req.json()) as { email?: string; name?: string };
    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const appUser = await provisionAppUser(admin, { email: body.email, name: body.name });
    return NextResponse.json({ appUser }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
