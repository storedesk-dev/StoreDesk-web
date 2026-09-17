import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { ReleaseInstallationSchema, releaseInstallation } from "@/lib/store-setup-key";

/**
 * The store PC gives up its installation ("Replace PC" on the desktop):
 * `{confirm: "REPLACE_PC"}` → `{released: true, tunnelRotated, reusableKey}`.
 * Worker credential. The credential is revoked (so a second call is 401),
 * the tunnel secret rotated and the installation reset to
 * `awaiting_activation`; the store's reusable key activates the next PC.
 * Audited `installation.release`. No secret in the answer.
 */
export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    await parseBody(req, ReleaseInstallationSchema);
    return NextResponse.json(await releaseInstallation(worker), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
