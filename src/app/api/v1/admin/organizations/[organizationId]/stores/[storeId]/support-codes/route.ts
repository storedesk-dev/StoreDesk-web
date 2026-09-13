import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { issueSupportCode, listSupportCodes } from "@/lib/support-codes";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** The store's latest support codes: status, who issued them, when; never the codes. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json({ supportCodes: await listSupportCodes(organizationId, storeId) }, { headers: NO_STORE });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Issue a support code for the store: 201 `{code, supportCode}`. `code`
 * (`sup_XXXXX-XXXXX`) is shown once; it works once, within 30 minutes, on
 * this store's PC only. Audited `support_code.issue`.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(await issueSupportCode(admin, organizationId, storeId), { status: 201, headers: NO_STORE });
  } catch (error) {
    return jsonError(error);
  }
}
