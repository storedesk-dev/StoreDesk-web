import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { AssignmentCreateSchema, addAssignment } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string; appUserId: string }> };

/** `{storeId | null, role}`: access at one store, or every store. 409 ASSIGNMENT_EXISTS. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, appUserId } = await ctx.params;
    const body = await parseBody(req, AssignmentCreateSchema);
    return NextResponse.json({ assignment: await addAssignment(admin, organizationId, appUserId, body) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
