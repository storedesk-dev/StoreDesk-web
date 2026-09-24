import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { LicenseCreateSchema, createLicense, listLicenses } from "@/lib/licenses";

type Ctx = { params: Promise<{ organizationId: string }> };

/** `{licensingMode, licenses}`: every license (cancelled ones too), the master first, each with the stores it covers. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    return NextResponse.json(await listLicenses(organizationId));
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Issue a store's license: `{storeId, plan, entitlementDays |
 * entitlementExpiresAt, maxPcsPerStore, offlineGraceDays, notes}`. A license
 * covers one store and nothing else (D-22), so 400 STORE_UNKNOWN for a store
 * outside this organization and 409 LICENSE_EXISTS for one that already has a
 * license — renew or edit that one instead.
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
