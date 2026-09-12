import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { gone, jsonError } from "@/lib/http";
import { listUsers } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string }> };

/**
 * @deprecated Use `GET …/organizations/{org}/users`. Kept for the
 * organization page written before it; same list under the old key.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    return NextResponse.json({ appUsers: await listUsers(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Turned off (P1): adding a user whose e-mail existed overwrote that login's
 * password — even one belonging to another organization — with no audit.
 */
export async function POST() {
  return gone(
    "This endpoint was removed because it could overwrite an existing login's password. Use POST /api/v1/admin/organizations/{org}/users."
  );
}
