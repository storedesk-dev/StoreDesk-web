import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { reissueInvitation } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string; appUserId: string }> };

/** A new invitation code for a user who has not set a password yet (shown once, e-mailed when configured). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId } = await ctx.params;
    return NextResponse.json(await reissueInvitation(admin, organizationId, appUserId), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
