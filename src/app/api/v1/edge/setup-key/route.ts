import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { APP_USER_HEADER, workerSetupKey } from "@/lib/store-setup-key";

/**
 * The store PC reads its own installation's reusable setup key, for the
 * desktop's "Replace PC": `{keyId, setupKey}`. Worker credential **and** the
 * signed-in person, named in `x-storedesk-app-user`, who must be an
 * organization admin — the key lets its holder take the store over, so the
 * PC's own page check is not enough. 10 a minute per installation; audited
 * `setup_key.reveal` with the worker as actor and `metadata.appUserId`.
 * 403 NOT_ORG_ADMIN, 404 SETUP_KEY_NOT_FOUND, 409 SETUP_KEY_NOT_READABLE.
 */
export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const appUserId = req.headers.get(APP_USER_HEADER);
    return NextResponse.json(await workerSetupKey(worker, appUserId), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
