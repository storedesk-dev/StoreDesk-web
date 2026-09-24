import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getStoreSetup } from "@/lib/setup";

type Ctx = { params: Promise<{ storeId: string }> };

/** PC & phones: installation, last seen, key status, org tag, tunnel, and why a key can't be issued. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    return NextResponse.json(await getStoreSetup(storeId));
  } catch (error) {
    return jsonError(error);
  }
}
