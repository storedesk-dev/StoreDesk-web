import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { SetPasswordSchema, setUserPassword } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string; appUserId: string }> };

/** An admin sets a new password (≥ 8). Audited; the user's stores pull it and end their sessions. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId } = await ctx.params;
    const { password } = await parseBody(req, SetPasswordSchema);
    return NextResponse.json(await setUserPassword(admin, organizationId, appUserId, password));
  } catch (error) {
    return jsonError(error);
  }
}
