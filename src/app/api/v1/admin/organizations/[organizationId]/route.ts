import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import {
  OrganizationDeleteSchema,
  OrganizationPatchSchema,
  deleteOrganization,
  getOrganizationDetail,
  updateOrganization
} from "@/lib/organizations";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    return NextResponse.json(await getOrganizationDetail(organizationId));
  } catch (error) {
    return jsonError(error);
  }
}

/** Name, org tag (rule + 409), status (active | suspended), billing e-mail. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, OrganizationPatchSchema);
    return NextResponse.json({ organization: await updateOrganization(admin, organizationId, body) });
  } catch (error) {
    return jsonError(error);
  }
}

/** Body `{confirmSlug}`: the org tag, typed. Cascades by id lists; audited. */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const { confirmSlug } = await parseBody(req, OrganizationDeleteSchema);
    return NextResponse.json(await deleteOrganization(admin, organizationId, confirmSlug));
  } catch (error) {
    return jsonError(error);
  }
}
