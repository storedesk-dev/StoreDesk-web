import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { SubscriptionPatchSchema, updateSubscription } from "@/lib/subscriptions";

type Ctx = { params: Promise<{ organizationId: string; subscriptionId: string }> };

/** Plan, status, limits, grace days, a new end date, or `renewDays`. Audited; the stores on it are notified. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, subscriptionId } = await ctx.params;
    const body = await parseBody(req, SubscriptionPatchSchema);
    return NextResponse.json({
      subscription: await updateSubscription(admin, organizationId, subscriptionId, body)
    });
  } catch (error) {
    return jsonError(error);
  }
}
