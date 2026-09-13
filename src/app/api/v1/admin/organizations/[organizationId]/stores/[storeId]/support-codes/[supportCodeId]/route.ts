import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { revokeSupportCode } from "@/lib/support-codes";

type Ctx = { params: Promise<{ organizationId: string; storeId: string; supportCodeId: string }> };

/** Revoke an active support code: `{supportCode}`. 409 SUPPORT_CODE_NOT_ACTIVE otherwise. Audited. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId, supportCodeId } = await ctx.params;
    return NextResponse.json({ supportCode: await revokeSupportCode(admin, organizationId, storeId, supportCodeId) });
  } catch (error) {
    return jsonError(error);
  }
}
