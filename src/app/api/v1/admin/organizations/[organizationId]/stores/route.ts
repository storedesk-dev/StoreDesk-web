import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createStore, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel, SubscriptionModel } from "@/models/ControlPlane";
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
    
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let subId = body.subscriptionId;
    if (!subId) {
      // Auto-resolve to the first active subscription
      await connectDb();
      const sub = await SubscriptionModel.findOne({
        organizationId,
        status: { $in: ["trialing", "active"] }
      }).lean();
      
      if (!sub) {
        return NextResponse.json({ error: "No active subscription found for this organization" }, { status: 400 });
      }
      subId = String(sub.subscriptionId);
    }

    const store = await createStore(admin, organizationId, {
      subscriptionId: subId,
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
