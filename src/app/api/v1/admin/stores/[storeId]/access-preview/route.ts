import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { accessPreview } from "@/lib/admin-views";

type Ctx = { params: Promise<{ storeId: string }> };

/** Per role: the pages it grants, each marked allowed or hidden because the store lacks a feature. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await accessPreview(storeId));
  } catch (error) {
    return jsonError(error);
  }
}
