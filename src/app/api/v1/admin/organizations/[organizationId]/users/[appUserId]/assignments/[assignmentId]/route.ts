import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { AssignmentPatchSchema, revokeAssignment, updateAssignment } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string; appUserId: string; assignmentId: string }> };

/** `{role?, storeId?}`: change the role, the store (null = every store), or both. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId, assignmentId } = await ctx.params;
    const body = await parseBody(req, AssignmentPatchSchema);
    return NextResponse.json({
      assignment: await updateAssignment(admin, organizationId, appUserId, assignmentId, body)
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Revoke. The stores it reached are notified and drop the user at their next pull. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId, assignmentId } = await ctx.params;
    return NextResponse.json(await revokeAssignment(admin, organizationId, appUserId, assignmentId));
  } catch (error) {
    return jsonError(error);
  }
}
