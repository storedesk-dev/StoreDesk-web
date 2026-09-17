import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { allowPcReplacement } from "@/lib/store-setup-key";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

/**
 * "Allow the next activation to replace the running PC": one activation with
 * the store's setup key may take over from the PC that is running now.
 * Internal admin, expires in 24 hours, spent by the activation that uses it,
 * audited `installation.replacement_allowed`.
 *
 * Without it a redeem against a live PC is refused `409 PC_ALREADY_ACTIVE` —
 * the normal path is Replace PC on the store PC itself, which releases the
 * installation. This is the recovery path for a PC that is dead, stolen or
 * unreachable.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(await allowPcReplacement(admin, organizationId, storeId), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
