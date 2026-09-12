import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { IssueSetupKeySchema, issueStoreSetupKey } from "@/lib/setup";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

/**
 * Issue the store PC's setup key: `{deliver: "show" | "email", contactEmail?}`.
 * Entitlement-checked (organization and store active, subscription entitled,
 * PCs per store). `show` returns the key once; `email` sends it to the store
 * contact. Earlier unused keys for the installation are revoked.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await parseBody(req, IssueSetupKeySchema);
    return NextResponse.json(await issueStoreSetupKey(admin, organizationId, storeId, body), {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
