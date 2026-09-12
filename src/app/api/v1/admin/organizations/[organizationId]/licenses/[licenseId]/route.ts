import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { LicensePatchSchema, updateLicense } from "@/lib/licenses";

type Ctx = { params: Promise<{ organizationId: string; licenseId: string }> };

/**
 * Plan, status (suspend / resume / cancel), `renewDays`, end date, seats (not
 * below seats used), PCs per store, grace, notes. Audited; every store the
 * license covers is notified.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, licenseId } = await ctx.params;
    const body = await parseBody(req, LicensePatchSchema);
    return NextResponse.json({ license: await updateLicense(admin, organizationId, licenseId, body) });
  } catch (error) {
    return jsonError(error);
  }
}
