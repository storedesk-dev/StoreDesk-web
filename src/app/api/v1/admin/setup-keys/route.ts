import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { issueStoreSetupKey } from "@/lib/setup";

const Body = z.object({
  organizationId: z.string().trim().min(1),
  storeId: z.string().trim().min(1)
});

/**
 * @deprecated Use `POST …/organizations/{org}/stores/{store}/setup-keys`.
 * Kept for the store page written before it. It now takes the one key path
 * (P8): entitlement-checked, status `shown`, standard errors.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await parseBody(req, Body);
    const issued = await issueStoreSetupKey(admin, organizationId, storeId, { deliver: "show" });
    return NextResponse.json(
      { setupKey: issued.setupKey, expiresAt: issued.expiresAt, workerInstallationId: issued.workerInstallationId },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
