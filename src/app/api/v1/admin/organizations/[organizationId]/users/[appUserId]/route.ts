import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { UserPatchSchema, updateUser } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string; appUserId: string }> };

/**
 * Name and status (`active` | `disabled`). A login is shared across the
 * organizations it belongs to, so disabling it disables it everywhere.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId } = await ctx.params;
    const body = await parseBody(req, UserPatchSchema);
    return NextResponse.json({ user: await updateUser(admin, organizationId, appUserId, body) });
  } catch (error) {
    return jsonError(error);
  }
}
