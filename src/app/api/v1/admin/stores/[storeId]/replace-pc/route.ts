import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { ReplacePcSchema, replaceStorePc } from "@/lib/setup";

type Ctx = { params: Promise<{ storeId: string }> };

/**
 * Replace this PC: revoke the installation's credential (the old PC is told
 * and turns sign-in off) and reset it to `awaiting_activation`, so a new setup
 * key activates a new PC. Body `{workerInstallationId?}` when the store has
 * more than one PC.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    const body = await parseBody(req, ReplacePcSchema);
    return NextResponse.json(await replaceStorePc(admin, storeId, body));
  } catch (error) {
    return jsonError(error);
  }
}
