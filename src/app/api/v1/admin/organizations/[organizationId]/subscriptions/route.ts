import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { requireOrganization } from "@/lib/organizations";
import { SubscriptionCreateSchema, createSubscription, listSubscriptions } from "@/lib/subscriptions";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await requireOrganization(organizationId);
    return NextResponse.json({ subscriptions: await listSubscriptions(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, SubscriptionCreateSchema);
    return NextResponse.json({ subscription: await createSubscription(admin, organizationId, body) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
