import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { StoreLicenseSchema, upsertStoreLicense } from "@/lib/licenses";
import { getStoreDetail } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ storeId: string }> };

/**
 * Store-wise organizations: issue the store's license when it has none
 * (`{plan, entitlementDays | entitlementExpiresAt, …}`), else edit it (the
 * license PATCH fields).
 * Answers the store as `GET …/stores/{store}` does, plus `created`.
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { storeId } = await ctx.params;
    const body = await parseBody(req, StoreLicenseSchema);
    const { created } = await upsertStoreLicense(admin, storeId, body);
    return NextResponse.json({ ...(await getStoreDetail(storeId)), created });
  } catch (error) {
    return jsonError(error);
  }
}
