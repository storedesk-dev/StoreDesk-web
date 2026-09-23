import "server-only";
import { TenantStoreModel } from "@/models/ControlPlane";
import { connectDb } from "@/lib/db";
import { buildStoreProjection } from "@/lib/supabase-projection";
import { runAfterResponse } from "@/lib/store-notify";
import { writeAudit } from "@/lib/audit";

/**
 * The service-role side of the lottery cloud. Server only, and small on purpose.
 *
 * It speaks PostgREST over HTTPS rather than Postgres: a serverless function that holds a database
 * connection is a connection pool waiting to run out, and the two things the control plane needs —
 * apply a projection, read a store's health — are one function call each.
 *
 * The service-role key is read here and nowhere else. It is never sent to a store, never put in a
 * response, and never logged; an error from this module names the status and nothing else.
 */

const TIMEOUT_MS = 8_000;

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export function isCloudConfigured(): boolean {
  return config() !== null;
}

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const settings = config();
  if (!settings) throw new Error("the lottery cloud is not configured");

  const response = await fetch(`${settings.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: settings.key,
      authorization: `Bearer ${settings.key}`,
      "content-profile": "app"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) {
    // The body can quote the payload back, and the payload holds password hashes.
    throw new Error(`the lottery cloud answered ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Push one store's projection. Answers what the cloud did with it: `applied`, or `stale` when
 * something newer is already there — which is what makes a retry free and an out-of-order push
 * harmless.
 */
export async function pushStoreProjection(storeId: string): Promise<"applied" | "stale" | "skipped"> {
  if (!isCloudConfigured()) return "skipped";
  await connectDb();

  // Every push carries a version, and the version goes up first: two pushes racing cannot swap.
  const bumped = await TenantStoreModel.findOneAndUpdate(
    { storeId },
    { $inc: { projectionVersion: 1 } },
    { new: true }
  ).lean();
  if (!bumped) return "skipped";

  const projection = await buildStoreProjection(storeId);
  if (!projection) return "skipped";

  const result = await rpc<string>("cp_apply_projection", { payload: projection });
  await TenantStoreModel.updateOne({ storeId }, { projectionPushedVersion: projection.version });
  return result === "stale" ? "stale" : "applied";
}

/**
 * Push after the response has gone, so an admin never waits on the cloud. A failure leaves
 * `projectionPushedVersion` behind `projectionVersion`, which is exactly what the hourly reconcile
 * looks for — nothing is lost by a push that did not land.
 */
export function scheduleProjectionPush(storeId: string, reason: string): void {
  if (!isCloudConfigured()) return;
  runAfterResponse(async () => {
    try {
      await pushStoreProjection(storeId);
    } catch (error) {
      console.warn(`[lottery-cloud] ${reason}: projection for ${storeId} did not land: ${error instanceof Error ? error.name : "Error"}`);
    }
  });
}

/** Stores the cloud is behind on. The hourly job re-pushes each and audits what it corrected. */
export async function storesNeedingProjection(limit = 200): Promise<string[]> {
  await connectDb();
  const stores = (await TenantStoreModel.find({
    status: { $ne: "closed" },
    $expr: { $ne: ["$projectionVersion", "$projectionPushedVersion"] }
  })
    .select("storeId")
    .limit(limit)
    .lean()) as Array<{ storeId: string }>;
  return stores.map((store) => store.storeId);
}

export async function reconcileProjections(limit = 200): Promise<{ checked: number; pushed: number; failed: number }> {
  const stores = await storesNeedingProjection(limit);
  let pushed = 0;
  let failed = 0;
  for (const storeId of stores) {
    try {
      await pushStoreProjection(storeId);
      pushed += 1;
      await writeAudit({
        actorType: "system",
        actorId: "lottery_cloud",
        action: "lottery.projection.reconciled",
        targetType: "store",
        targetId: storeId
      });
    } catch {
      failed += 1;
    }
  }
  return { checked: stores.length, pushed, failed };
}

/** What the admin console shows about a lottery PC: alive, how far behind, when it last closed. */
export async function readStoreHealth(storeId: string): Promise<Record<string, unknown> | null> {
  if (!isCloudConfigured()) return null;
  try {
    return await rpc<Record<string, unknown>>("cp_store_health", { p_store_id: storeId });
  } catch {
    // A cloud that cannot be reached is "unknown" on the screen, never an error page for an admin
    // who only wanted to look at a store.
    return null;
  }
}
