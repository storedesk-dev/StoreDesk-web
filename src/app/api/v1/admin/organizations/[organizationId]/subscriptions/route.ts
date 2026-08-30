import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createSubscription, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { SubscriptionModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await connectDb();
    const subscriptions = await SubscriptionModel.find({ organizationId }).lean();
    return NextResponse.json({ subscriptions: safeJson(subscriptions) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = (await req.json()) as {
      plan?: "trial" | "standard" | "custom";
      maxStores?: number;
      maxWorkerInstallations?: number;
      entitlementDays?: number;
    };
    if (!body.plan) return NextResponse.json({ error: "plan is required" }, { status: 400 });
    const subscription = await createSubscription(admin, organizationId, {
      ...body,
      plan: body.plan
    });
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
