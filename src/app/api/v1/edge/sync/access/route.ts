import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError, writeAudit } from "@/lib/control-plane";
import { enforceRateLimit } from "@/lib/control-plane-security";
import { loadAccessSync } from "@/lib/access-sync";

/**
 * The store server's access pull (docs/design/store-sign-in-and-sync.md):
 * organization, store, subscription, every role, and the users assigned to the
 * calling installation — with password hashes, so the store can check
 * passwords itself while offline. Worker credential only; the installation
 * comes from the credential, never from the request. See lib/access-sync.ts
 * for why this is the one response allowed to carry `passwordHash`.
 */
export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    enforceRateLimit(`edge-access:${worker.workerInstallationId}`, {
      limit: 30,
      windowMs: 60_000
    });
    const body = await loadAccessSync(worker);
    await writeAudit({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId,
      actorType: "worker",
      actorId: worker.workerInstallationId,
      action: "edge.access_sync",
      targetType: "worker_installation",
      targetId: worker.workerInstallationId,
      // Counts and the content version only — never a hash.
      metadata: { version: body.version, users: body.users.length, roles: body.roles.length }
    });
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
