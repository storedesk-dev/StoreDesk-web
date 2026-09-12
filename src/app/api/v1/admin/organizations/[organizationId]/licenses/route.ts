import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { requireOrganization } from "@/lib/organizations";
import { LicenseCreateSchema, createLicense, listLicenses } from "@/lib/licenses";

type Ctx = { params: Promise<{ organizationId: string }> };

/** Both scopes, the organization license first, each with the stores it covers and seats used. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await requireOrganization(organizationId);
    return NextResponse.json({ licenses: await listLicenses(organizationId) });
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Create a license: `{scope: "organization", plan, entitlementDays |
 * entitlementExpiresAt, maxStores, maxPcsPerStore, offlineGraceDays, notes}`
 * or `{scope: "store", storeId, …}` (which becomes that store's covering
 * license). 409 LICENSE_EXISTS when the scope already has a non-cancelled one.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, LicenseCreateSchema);
    return NextResponse.json({ license: await createLicense(admin, organizationId, body) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
