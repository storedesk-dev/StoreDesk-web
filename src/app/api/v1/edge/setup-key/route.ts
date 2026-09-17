import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { workerSetupKey } from "@/lib/store-setup-key";

/**
 * The store PC reads its own installation's reusable setup key, for the
 * desktop's "Replace PC" (shown to a signed-in user with the StoreDesk
 * Service page, on the store PC only): `{keyId, setupKey}`. Worker
 * credential; 10 a minute per installation; audited `setup_key.reveal` with
 * the worker as actor. 404 SETUP_KEY_NOT_FOUND, 409 SETUP_KEY_NOT_READABLE.
 */
export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    return NextResponse.json(await workerSetupKey(worker), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
