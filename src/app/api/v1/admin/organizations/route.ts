import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createOrganization, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { OrganizationModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    await connectDb();
    const rows = await OrganizationModel.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ organizations: safeJson(rows) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    const body = (await req.json()) as { name?: string; slug?: string; billingEmail?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const organization = await createOrganization(admin, {
      name: body.name,
      slug: body.slug,
      billingEmail: body.billingEmail
    });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
