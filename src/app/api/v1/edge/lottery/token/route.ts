import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateWorker } from "@/lib/admin-auth";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";
import { LOTTERY } from "@/lib/products";
import { WorkerInstallationModel } from "@/models/ControlPlane";
import { connectDb } from "@/lib/db";
import { isSupabaseConfigured, mintSupabaseToken } from "@/lib/supabase-token";
import { publishableCloud, scheduleProjectionPush } from "@/lib/supabase-admin";

/**
 * A lottery PC asks for its hour of Supabase.
 *
 * This is the one hop between the two halves of the design: the control plane owns who may read
 * what (D-17), so it is the only thing that mints a token, and it mints it from the worker
 * credential the PC already holds. **No new secret lands on a store PC**, and no store PC ever holds
 * the JWT secret or the service-role key.
 *
 * It also answers *where* the cloud is. That is deliberate: if the project URL and publishable key
 * were env on every PC, moving projects or rotating a key would mean touching every counter in
 * every shop. Here it is one deployment, and a PC only ever needs to know its control plane.
 *
 * And it is the switch. A control plane with no cloud configured answers `CLOUD_UNAVAILABLE`, and a
 * PC that hears that stays exactly as it is today: local, with SQLite as its only source of truth.
 */
const TokenSchema = z
  .object({
    appVersion: z.string().trim().max(40).optional(),
    schemaVersion: z.number().int().min(0).max(1000).optional(),
    /** How far the PC has read the change log, and how much it still owes the cloud. */
    cursorSeq: z.number().int().min(0).optional(),
    pendingOps: z.number().int().min(0).optional()
  })
  .strict();

export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req, LOTTERY);
    // Generous: a PC mints once an hour in the ordinary case, and retries after a restart or a
    // dropped line. Tight enough that a loop cannot hammer the signer.
    enforceRateLimit(`lottery-token:${worker.workerInstallationId}`, { limit: 60, windowMs: 60 * 60_000, code: "RATE_LIMITED" });
    const body = await parseBody(req, TokenSchema);

    if (!isSupabaseConfigured()) {
      throw new ControlPlaneError(503, "CLOUD_UNAVAILABLE", "The lottery cloud is not configured", true);
    }

    // The credential proves a store; it does not prove *which product's* PC is holding it. A
    // StoreDesk Service credential must not mint a token that signs a lottery PC's audit rows.
    await connectDb();
    const installation = await WorkerInstallationModel.findOne({
      workerInstallationId: worker.workerInstallationId,
      product: LOTTERY
    })
      .select("workerInstallationId appVersion")
      .lean();
    if (!installation) {
      throw new ControlPlaneError(403, "NOT_A_LOTTERY_PC", "This credential is not a StoreDesk Lottery installation");
    }

    const { token, expiresAt } = mintSupabaseToken({
      kind: "device",
      org: worker.organizationId,
      store: worker.storeId,
      sub: worker.workerInstallationId
    });

    // What the PC reported about itself goes to Mongo, where the admin console reads it, and the
    // projection carries it on. The PC's own heartbeat into Supabase (`app.device_heartbeat`) keeps
    // the cursor and the backlog fresh between pushes; this is the slower, durable copy.
    const heartbeat: Record<string, unknown> = { lastSeenAt: new Date() };
    if (body.appVersion) heartbeat["appVersion"] = body.appVersion;
    if (body.schemaVersion !== undefined) heartbeat["schemaVersion"] = body.schemaVersion;
    await WorkerInstallationModel.updateOne(
      { workerInstallationId: worker.workerInstallationId },
      { $set: heartbeat }
    );

    // A PC asking for a token is a PC about to read: make sure what it reads is current. The push
    // is a no-op when nothing changed, and it never delays this response.
    scheduleProjectionPush(worker.storeId, "lottery token minted");

    return NextResponse.json(
      {
        token,
        expiresAt: expiresAt.toISOString(),
        // Public by design: the publishable key reads nothing without the token above it.
        cloud: publishableCloud(),
        organizationId: worker.organizationId,
        storeId: worker.storeId,
        deviceId: worker.workerInstallationId
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return jsonError(error);
  }
}
