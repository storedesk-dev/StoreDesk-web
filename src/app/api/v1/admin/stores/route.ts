import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { listAllStores } from "@/lib/tenant-stores";

/**
 * `GET /api/v1/admin/stores` — every store, with its PC and its covering license.
 *
 * The admin console's front page (D-22). Staff only, like every route under `/admin`: there is no
 * organization in the path because there is nothing above a store, and what refuses a stranger is
 * the session, not the path.
 */
export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    return NextResponse.json({ stores: await listAllStores() });
  } catch (error) {
    return jsonError(error);
  }
}
