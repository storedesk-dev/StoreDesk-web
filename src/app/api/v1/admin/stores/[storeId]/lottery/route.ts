import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { lotteryPcView } from "@/lib/lottery-pc";

type Ctx = { params: Promise<{ storeId: string }> };

/** The store's StoreDesk Lottery PC: which one, who bound it, when it was last seen, and the cloud's view. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await lotteryPcView(storeId), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
