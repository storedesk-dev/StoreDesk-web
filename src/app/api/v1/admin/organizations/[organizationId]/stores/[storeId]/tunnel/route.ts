import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { retryStoreTunnel } from "@/lib/tenant-stores";

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
