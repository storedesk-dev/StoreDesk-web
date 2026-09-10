import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { buildEdgeConfigJson, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { ControlPlaneError, safeJson } from "@/lib/control-plane-security";
import { z } from "zod";

/**
 * Store configuration the edge may push up.
 *
 * `posPassword` is deliberately absent and is rejected by `.strict()`. The
 * register password is a purely local secret: the Worker is the only thing that
 * ever dials the register, and it does so over the store LAN. Sending it to the
 * control plane put a plaintext POS credential in Atlas, in this request body,
 * in `configJson`, and — because `configJson` is handed to every client of the
 * store — in front of every signed-in user. None of that bought anything.
 *
 * The password is entered once in the desktop app's Settings page and stays on
 * the store PC. Host and username are ordinary configuration and may sync.
 */
const EdgeConfigSchema = z
  .object({
    posIntegration: z.literal("verifone_commander"),
    posIpAddress: z.string().optional(),
    posUsername: z.string().optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional()
  })
  .strict();

export async function PUT(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const raw = (await req.json()) as Record<string, unknown>;

    if ("posPassword" in raw) {
      throw new ControlPlaneError(
        400,
        "REQUEST_INVALID",
        "posPassword is not accepted: register credentials stay on the store PC"
      );
    }

    const body = EdgeConfigSchema.parse(raw);

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
    const merged: Record<string, unknown> = { ...current, ...body };
    // Scrub any password left in the store document by an older build.
    delete merged.posPassword;

    store.configJson = JSON.stringify(merged, null, 2);
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
      .select("+cloudflareToken")
      .lean();
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    return NextResponse.json(
      {
        configJson: await buildEdgeConfigJson(worker.organizationId, store),
        cloudflareToken: store.cloudflareToken ? String(store.cloudflareToken) : null,
        tunnelUrl: store.tunnelUrl ? String(store.tunnelUrl) : null
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
