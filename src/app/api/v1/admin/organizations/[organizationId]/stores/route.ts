import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { StoreCreateSchema, createStore, listStores } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    return NextResponse.json({ stores: await listStores(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Create a store on a subscription (its `maxStores` counts that
 * subscription's stores) and try to create its tunnel. The answer says how
 * the tunnel went: `tunnel.status` ok | not_configured | failed.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, StoreCreateSchema);
    return NextResponse.json(await createStore(admin, organizationId, body), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
