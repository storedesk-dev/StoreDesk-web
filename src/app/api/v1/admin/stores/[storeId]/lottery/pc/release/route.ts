import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { releaseLotteryPc } from "@/lib/lottery-pc";

type Ctx = { params: Promise<{ storeId: string }> };

/**
 * Release the store's lottery PC: the same effect as Switch store on the PC. Its credentials are
 * revoked and the next person to sign in on any PC can pick the store. Audited.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await releaseLotteryPc(admin, storeId));
  } catch (error) {
    return jsonError(error);
  }
}
