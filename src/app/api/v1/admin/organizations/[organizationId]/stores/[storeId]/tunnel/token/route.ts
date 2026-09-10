import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, writeAudit } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

/**
 * Reveal a store's Cloudflare tunnel token to an internal operator.
 *
 * This is the *only* way the token leaves the control plane towards a human.
 * It is stripped from every other response by `safeJson()`, so the store detail
 * page has to ask for it explicitly — it is never part of a page payload that
 * might end up in a screenshot, a log, or a browser cache.
 *
 * Normal activation does not need this: the Worker receives the token
 * automatically when it redeems its setup key. This exists for support,
 * recovery, and customers who run `cloudflared` themselves.
 *
 * Every call is rate-limited and audited with the requesting admin's identity.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;

    enforceRateLimit(`tunnel-token:${admin.adminId}`, { limit: 10, windowMs: 60_000 });

    await connectDb();
    const store = await TenantStoreModel.findOne({ organizationId, storeId })
      .select("+cloudflareToken")
      .lean();
    if (!store) {
      throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");
    }
    if (!store.cloudflareToken) {
      throw new ControlPlaneError(
        409,
        "TUNNEL_NOT_PROVISIONED",
        "This store has no Cloudflare tunnel yet"
      );
    }

    await writeAudit({
      organizationId,
      storeId,
      actorType: "internal_admin",
      actorId: admin.adminId,
      action: "tunnel_token.reveal",
      targetType: "store",
      targetId: storeId,
      reason: "operator requested tunnel token"
    });

    return NextResponse.json(
      {
        storeId,
        tunnelUrl: store.tunnelUrl ?? null,
        cloudflareToken: String(store.cloudflareToken)
      },
      // Bearer credential: never cached, never stored by an intermediary.
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
