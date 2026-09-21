import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { issueLotterySetupKey, lotteryInstallationView } from "@/lib/lottery-setup";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

const IssueSchema = z.object({ contactEmail: z.string().trim().email().optional() }).strict();

/** The store's lottery PC: which one holds it, since when, and whether a key is waiting. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(
      { installation: await lotteryInstallationView(organizationId, storeId) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Issue the key that authorises a StoreDesk Lottery PC for this store. Refused unless the store
 * sells lottery, is switched on for the app, and has a licence in force — the same reasons the app's
 * store picker greys a row, checked again here where it matters. The key is returned once.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await parseBody(req, IssueSchema);
    return NextResponse.json(await issueLotterySetupKey(admin, organizationId, storeId, body.contactEmail), {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
