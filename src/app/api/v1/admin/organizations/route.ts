import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { OrganizationCreateSchema, createOrganization, listOrganizations } from "@/lib/organizations";

/** Every organization with its store and user counts and current subscription. */
export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    return NextResponse.json({ organizations: await listOrganizations() });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Create an organization (org-tag rule, 409 SLUG_TAKEN on a duplicate) with
 * the four role templates, and optionally its first subscription.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    const body = await parseBody(req, OrganizationCreateSchema);
    return NextResponse.json(await createOrganization(admin, body), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
