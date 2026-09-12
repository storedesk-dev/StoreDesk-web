import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { LicensingModeSchema, changeLicensingMode } from "@/lib/licenses";

type Ctx = { params: Promise<{ organizationId: string }> };

/**
 * Switch the organization's licensing mode: `{mode: "master" | "storeWise",
 * dryRun?, copyToStores?, master?}`.
 * - → storeWise: each store gets a copy of the master (plan, status, end,
 *   grace, PCs) unless `copyToStores: false`; the master is cancelled.
 * - → master: `master` is the new master license's terms; store licenses are
 *   cancelled ("superseded by master license").
 * `dryRun: true` answers the effect per store (`stores[]` with `before` and
 * `after`, `licenses.created` / `licenses.cancelled`) and writes nothing. The
 * real run is one transaction, audited, and notifies every store.
 * 409 LICENSING_MODE_UNCHANGED when already in that mode.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await parseBody(req, LicensingModeSchema);
    return NextResponse.json(await changeLicensingMode(admin, organizationId, body));
  } catch (error) {
    return jsonError(error);
  }
}
