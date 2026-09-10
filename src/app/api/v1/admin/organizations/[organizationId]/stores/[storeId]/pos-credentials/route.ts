import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError, writeAudit } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { isStoreSecretConfigured, sealStoreSecret } from "@/lib/store-secrets";
import { z } from "zod";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

const Body = z.object({
  posIpAddress: z.string().trim().min(1, "A register host or IP is required"),
  posUsername: z.string().trim().min(1, "A register username is required"),
  // Omit to leave the stored password untouched, so an operator can correct a
  // typo'd IP without knowing the password.
  posPassword: z.string().optional()
});

/**
 * Register credentials for one store, set by an operator.
 *
 * The password is encrypted before it reaches the database and is delivered
 * only to that store's own authenticated Worker, through config sync. It is
 * never returned by this endpoint or any other — a client can set it, and no
 * client can read it back.
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = Body.parse(await req.json());

    if (body.posPassword && !isStoreSecretConfigured()) {
      throw new ControlPlaneError(
        503,
        "STORE_SECRET_UNAVAILABLE",
        "STORE_SECRET_KEY is not set on this deployment, so a register password cannot be stored."
      );
    }

    await connectDb();
    const store = await TenantStoreModel.findOne({ organizationId, storeId });
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    let config: Record<string, unknown> = {};
    if (store.configJson?.trim()) {
      try {
        config = JSON.parse(store.configJson);
      } catch {
        /* an unparseable stored config is replaced */
      }
    }
    config.posIntegration = "verifone_commander";
    config.posIpAddress = body.posIpAddress;
    config.posUsername = body.posUsername;
    // Belt and braces: the password lives in its own encrypted field. configJson
    // is handed to every signed-in client of this store.
    delete config.posPassword;
    store.configJson = JSON.stringify(config, null, 2);

    const hadPassword = Boolean(store.get("posPasswordCipher"));
    if (body.posPassword) {
      store.set("posPasswordCipher", sealStoreSecret(body.posPassword));
    }
    await store.save();

    await writeAudit({
      organizationId,
      storeId,
      actorType: "internal_admin",
      actorId: admin.adminId,
      action: "pos_credentials.update",
      targetType: "store",
      targetId: storeId,
      metadata: { passwordChanged: Boolean(body.posPassword) }
    });

    return NextResponse.json({
      posIpAddress: body.posIpAddress,
      posUsername: body.posUsername,
      // A boolean, not the value.
      passwordOnFile: Boolean(body.posPassword) || hadPassword
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "REQUEST_INVALID",
            message: error.issues[0]?.message ?? "Invalid request"
          }
        },
        { status: 400 }
      );
    }
    return jsonError(error);
  }
}

/** Current register settings. Reports whether a password is on file, never what it is. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;

    await connectDb();
    const store = await TenantStoreModel.findOne({ organizationId, storeId })
      .select("+posPasswordCipher")
      .lean();
    if (!store) throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Store not found");

    let config: Record<string, unknown> = {};
    if (typeof store.configJson === "string" && store.configJson.trim()) {
      try {
        config = JSON.parse(store.configJson);
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      posIpAddress: String(config.posIpAddress ?? ""),
      posUsername: String(config.posUsername ?? ""),
      passwordOnFile: Boolean(store.posPasswordCipher),
      secretStorageAvailable: isStoreSecretConfigured()
    });
  } catch (error) {
    return jsonError(error);
  }
}
