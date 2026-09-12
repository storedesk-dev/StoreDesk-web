import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { CoverageSchema, setStoreCoverage } from "@/lib/licenses";
import { getStoreDetail } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

/**
 * Switch the store's coverage: `{mode: "organization" | "store" | "none",
 * newLicense?}`. A seat is checked on the organization license; switching
 * away from the store's own license cancels it. Answers the store as
 * `GET …/stores/{store}` does, plus `changed`.
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await parseBody(req, CoverageSchema);
    const { changed } = await setStoreCoverage(admin, organizationId, storeId, body);
    return NextResponse.json({ ...(await getStoreDetail(organizationId, storeId)), changed });
  } catch (error) {
    return jsonError(error);
  }
}
