import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import { mintGoogleAccessToken, requireServiceAccount } from "@/lib/google";
import { normalizeStoreSettings } from "@/lib/store-settings";
import { requireStore } from "@/lib/tenant-stores";

/**
 * A short-lived Google access token for the calling store server (worker
 * credential), so the StoreDesk service-account key never leaves the control
 * plane. Only for a store with Google Sheets turned on. Rate-limited per
 * installation; every issue is audited (never the token).
 *
 * 200 `{accessToken, expiresAt, clientEmail, scopes}`; 503
 * GOOGLE_NOT_CONFIGURED; 409 GOOGLE_SHEETS_NOT_ENABLED.
 */
export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    enforceRateLimit(`edge-google:${worker.workerInstallationId}`, { limit: 20, windowMs: 10 * 60_000 });
    requireServiceAccount();
    const store = await requireStore(worker.organizationId, worker.storeId);
    if (!normalizeStoreSettings(store.settings).integrations.googleSheets.enabled) {
      throw new ControlPlaneError(409, "GOOGLE_SHEETS_NOT_ENABLED", "Google Sheets is not turned on for this store");
    }
    const token = await mintGoogleAccessToken();
    await writeAudit({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId,
      actorType: "worker",
      actorId: worker.workerInstallationId,
      action: "edge.google_access_token",
      targetType: "store",
      targetId: worker.storeId,
      metadata: { clientEmail: token.clientEmail, expiresAt: token.expiresAt }
    });
    return NextResponse.json(token, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
