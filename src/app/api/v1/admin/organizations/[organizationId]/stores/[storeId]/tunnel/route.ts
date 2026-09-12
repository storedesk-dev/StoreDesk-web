import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { auditAdmin } from "@/lib/audit";
import { jsonError, parseBody } from "@/lib/http";
import { TenantStoreModel } from "@/models/ControlPlane";
import { requireStore, retryStoreTunnel } from "@/lib/tenant-stores";
import { tunnelView } from "@/lib/tunnel";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

const RetrySchema = z.object({ label: z.string().trim().max(63).optional() }).strict();

/**
 * Re-provision a failed or missing tunnel (P6). 200 `{tunnel}`; 409
 * TUNNEL_EXISTS; 503 TUNNEL_NOT_CONFIGURED; 502 TUNNEL_PROVISION_FAILED — the
 * last three carry the current `tunnel` beside the error.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await parseBody(req, RetrySchema);
    return NextResponse.json({ tunnel: await retryStoreTunnel(admin, organizationId, storeId, body) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Forget the store's tunnel URL and token (the Cloudflare tunnel itself is
 * left alone). Used by the store page written before `POST`; audited.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    await requireStore(organizationId, storeId);
    await TenantStoreModel.updateOne(
      { organizationId, storeId },
      { $unset: { tunnelUrl: 1, cloudflareToken: 1, tunnelStatus: 1, tunnelError: 1 } }
    );
    await auditAdmin(admin, {
      organizationId,
      storeId,
      action: "store.tunnel.clear",
      targetType: "store",
      targetId: storeId
    });
    return NextResponse.json({ tunnel: tunnelView(await requireStore(organizationId, storeId)) });
  } catch (error) {
    return jsonError(error);
  }
}
