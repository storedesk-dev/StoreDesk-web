import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { buildEdgeConfigJson, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { ControlPlaneError, safeJson } from "@/lib/control-plane-security";
import { isStoreSecretConfigured, openStoreSecret, sealStoreSecret } from "@/lib/store-secrets";
import { z } from "zod";

/**
 * Store configuration the edge may push up.
 *
 * `posPassword` is accepted so an operator can set the register credential from
 * any surface — desktop, phone, or the control plane — and have it reach every
 * other one. It is never stored the way it arrives:
 *
 *   - encrypted at rest in its own `select: false` field, not in `configJson`;
 *   - stripped from `configJson`, which is handed to every signed-in client;
 *   - returned only to the store's own authenticated Worker, over TLS.
 *
 * A client can set it. No client can read it back.
 */
const EdgeConfigSchema = z
  .object({
    posIntegration: z.literal("verifone_commander"),
    posIpAddress: z.string().optional(),
    posUsername: z.string().optional(),
    posPassword: z.string().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional()
  })
  .strict();

export async function PUT(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const body = EdgeConfigSchema.parse(await req.json());

    if (body.posPassword && !isStoreSecretConfigured()) {
      throw new ControlPlaneError(
        503,
        "STORE_SECRET_UNAVAILABLE",
        "STORE_SECRET_KEY is not set on this deployment, so a register password cannot be stored."
      );
    }

    await connectDb();
    const store = await TenantStoreModel.findOne({
      organizationId: worker.organizationId,
      storeId: worker.storeId
    });
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    let current: Record<string, unknown> = {};
    if (store.configJson?.trim()) {
      try {
        current = JSON.parse(store.configJson);
      } catch {
        /* an unparseable stored config is replaced wholesale */
      }
    }
    // The password takes the encrypted path; everything else is ordinary config.
    const { posPassword, ...publicConfig } = body;
    const merged: Record<string, unknown> = { ...current, ...publicConfig };
    // Scrub any plaintext password left in the document by an older build.
    delete merged.posPassword;

    store.configJson = JSON.stringify(merged, null, 2);
    if (posPassword) {
      store.set("posPasswordCipher", sealStoreSecret(posPassword));
    }
    await store.save();

    return NextResponse.json({ store: safeJson(store.toObject()) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "REQUEST_INVALID", message: "Invalid configuration schema" } },
        { status: 400 }
      );
    }
    return jsonError(error);
  }
}

export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    await connectDb();

    // Tunnel fields live on the Store, not the WorkerInstallation. Reading them
    // off the installation is what previously made this endpoint always return
    // `undefined` and leave the tunnel unprovisioned.
    const store = await TenantStoreModel.findOne({
      organizationId: worker.organizationId,
      storeId: worker.storeId
    })
      .select("+cloudflareToken +posPasswordCipher")
      .lean();
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    return NextResponse.json(
      {
        configJson: await buildEdgeConfigJson(worker.organizationId, store),
        cloudflareToken: store.cloudflareToken ? String(store.cloudflareToken) : null,
        tunnelUrl: store.tunnelUrl ? String(store.tunnelUrl) : null,
        // Delivered here and nowhere else. The caller is this store's own
        // Worker, proven by its credential; `configJson` above deliberately
        // does not contain it, because that blob reaches every client.
        posPassword: openStoreSecret(store.posPasswordCipher)
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
