import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { buildEdgeConfigJson, jsonError } from "@/lib/control-plane";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { isStoreSecretConfigured, openStoreSecret, sealStoreSecret } from "@/lib/store-secrets";
import { readRegisterConfig, registerConfigJson } from "@/lib/tenant-stores";
import { edgeTunnelState } from "@/lib/tunnel";
import { z } from "zod";

/**
 * Register settings the store server pushes up after an operator sets them on
 * the PC. `posPassword` is stored encrypted in its own field, never in
 * `configJson`, and returned only to this store's own server. `featureFlags`
 * is accepted from older store builds and ignored: configJson is the register
 * connection only (P2, P17).
 */
const EdgeConfigSchema = z
  .object({
    posIntegration: z.literal("verifone_commander"),
    posIpAddress: z.string().max(200).optional(),
    posUsername: z.string().max(200).optional(),
    posPassword: z.string().max(500).optional(),
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

    const current = readRegisterConfig(store.configJson);
    store.configJson = registerConfigJson({
      posIpAddress: body.posIpAddress ?? current.posIpAddress,
      posUsername: body.posUsername ?? current.posUsername
    });
    if (body.posPassword) {
      store.set("posPasswordCipher", sealStoreSecret(body.posPassword));
    }
    await store.save();
    await writeAudit({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId,
      actorType: "worker",
      actorId: worker.workerInstallationId,
      action: "pos_credentials.update",
      targetType: "store",
      targetId: worker.storeId,
      metadata: { passwordChanged: Boolean(body.posPassword) }
    });

    const register = readRegisterConfig(store.configJson);
    return NextResponse.json({
      store: {
        storeId: worker.storeId,
        configJson: store.configJson,
        posIpAddress: register.posIpAddress,
        posUsername: register.posUsername
      }
    });
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

    const store = await TenantStoreModel.findOne({
      organizationId: worker.organizationId,
      storeId: worker.storeId
    })
      .select("+cloudflareToken +posPasswordCipher")
      .lean();
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    // `tunnel.state`: active | deleted (clear the token, stop the tunnel) |
    // none (never had one, or it could not be provisioned). The token and URL
    // are sent only while active, so a dead token is never kept.
    const state = edgeTunnelState(store as Record<string, unknown>);
    const active = state === "active";
    return NextResponse.json(
      {
        configJson: buildEdgeConfigJson(store),
        tunnel: { state, url: active ? String(store.tunnelUrl) : null },
        cloudflareToken: active ? String(store.cloudflareToken) : null,
        tunnelUrl: active ? String(store.tunnelUrl) : null,
        // Delivered here and nowhere else: the caller is this store's own
        // server, proven by its credential.
        posPassword: openStoreSecret(store.posPasswordCipher)
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
