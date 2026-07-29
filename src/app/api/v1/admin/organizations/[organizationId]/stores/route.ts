import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createStore, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await connectDb();
    const stores = await TenantStoreModel.find({ organizationId }).lean();
    return NextResponse.json({ stores: safeJson(stores) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = (await req.json()) as {
      subscriptionId?: string;
      name?: string;
      storeNumber?: string;
      address?: string;
      contactEmail?: string;
    };
    if (!body.subscriptionId || !body.name?.trim()) {
      return NextResponse.json({ error: "subscriptionId and name are required" }, { status: 400 });
    }
    const store = await createStore(admin, organizationId, {
      subscriptionId: body.subscriptionId,
      name: body.name,
      storeNumber: body.storeNumber,
      address: body.address,
      contactEmail: body.contactEmail
    });
    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
