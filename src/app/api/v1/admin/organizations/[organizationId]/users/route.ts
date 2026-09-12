import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { AddUserSchema, addUser, listUsers } from "@/lib/users";

type Ctx = { params: Promise<{ organizationId: string }> };

/** The organization's users (logins with an active assignment here), each with their assignments. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    return NextResponse.json({ users: await listUsers(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Add a user: `{mode: "managed", email, name?, password, assignments}` or
 * `{mode: "invite", email, name?, assignments}`. A login that already exists
 * keeps its password and details; only the assignments are added (200,
 * `existing: true`). A new login is 201; an invitation code is returned once.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, AddUserSchema);
    const result = await addUser(admin, organizationId, body);
    return NextResponse.json(result, {
      status: result.existing ? 200 : 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
