import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { listAudit } from "@/lib/admin-views";

type Ctx = { params: Promise<{ organizationId: string }> };

/**
 * Activity, newest first: `?cursor&action&limit` (limit 1–200, default 50).
 * `nextCursor` is null on the last page. Store access pulls are left out
 * unless `action=edge.access_sync`.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const params = new URL(req.url).searchParams;
    return NextResponse.json(
      await listAudit(organizationId, {
        cursor: params.get("cursor"),
        action: params.get("action"),
        limit: Number(params.get("limit") ?? 50)
      })
    );
  } catch (error) {
    return jsonError(error);
  }
}
