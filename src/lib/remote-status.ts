import { connectDb } from "@/lib/db";
import { getCloudflareTunnelHealth } from "@/lib/cloudflare";
import { cloudflareConfigured } from "@/lib/tunnel";
import { TenantStoreModel, WorkerInstallationModel } from "@/models/ControlPlane";

/**
 * Can phones reach a store right now? (`remote` in the org-tag lookup, the
 * store's PC & phones tab, and the dashboard.)
 *
 * 1. Cloudflare configured and the store has a tunnel (by id): the tunnel's
 *    status — `healthy` / `degraded` → online, `down` / `inactive` → offline.
 *    Cached per tunnel for 60 s (15 s after a failure). Cloudflare gets 1.5 s;
 *    after that the answer is `unknown`, so a slow Cloudflare never slows or
 *    fails the lookup.
 * 2. Otherwise (no Cloudflare, e.g. dev:local, or no tunnel): online when the
 *    store PC checked in within 10 minutes (`lastSeenAt`), else unknown.
 *
 * `since`: Cloudflare's connection timestamps when it has them, else when
 * this status was first observed (`remoteStatus` / `remoteStatusSince` on
 * the store). Always rounded down to the minute.
 *
 * Development only: `STOREDESK_REMOTE_STATUS_STUB` (set by `npm run
 * dev:local`) replaces the source with fixed answers per store id, `"*"` for
 * the rest. Ignored when NODE_ENV is production.
 */

type Doc = Record<string, unknown>;
export type RemoteState = "online" | "offline" | "unknown";
export type RemoteStatus = { status: RemoteState; since: string | null };

export const REMOTE_TIMEOUT_MS = 1_500;
export const REMOTE_CACHE_MS = 60_000;
const FAILED_CACHE_MS = 15_000;
export const HEARTBEAT_FRESH_MS = 10 * 60_000;
export const REMOTE_STUB_ENV = "STOREDESK_REMOTE_STATUS_STUB";
const LIVE_INSTALL = ["active", "degraded"];
const UNKNOWN: RemoteStatus = { status: "unknown", since: null };

export function mapCloudflareTunnelStatus(status: unknown): RemoteState {
  switch (typeof status === "string" ? status.trim().toLowerCase() : "") {
    case "healthy":
    case "degraded":
      return "online";
    case "down":
    case "inactive":
      return "offline";
    default:
      return "unknown";
  }
}

function asDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** ISO, rounded down to the minute: all `since` exposes. */
export function minuteIso(value: unknown): string | null {
  const date = asDate(value);
  return date ? new Date(Math.floor(date.getTime() / 60_000) * 60_000).toISOString() : null;
}

type Observation = { status: RemoteState; since: Date | null };

const cache = new Map<string, { expires: number; value: Observation }>();

export function resetRemoteStatusCacheForTests(): void {
  cache.clear();
}

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** One tunnel's state from Cloudflare. Never throws, never takes longer than the timeout. */
export async function cloudflareObservation(tunnelId: string): Promise<Observation> {
  const hit = cache.get(tunnelId);
  if (hit && hit.expires > Date.now()) return hit.value;
  let value: Observation = { status: "unknown", since: null };
  let ttl = FAILED_CACHE_MS;
  try {
    const health = await withTimeout((signal) => getCloudflareTunnelHealth(tunnelId, signal), REMOTE_TIMEOUT_MS);
    const status = mapCloudflareTunnelStatus(health?.status);
    value = {
      status,
      since:
        status === "online"
          ? (asDate(health?.connsActiveAt) ?? asDate(health?.openedAt))
          : status === "offline"
            ? asDate(health?.connsInactiveAt)
            : null
    };
    if (status !== "unknown") ttl = REMOTE_CACHE_MS;
  } catch {
    // Slow, refused or unreachable: unknown, and asked again soon.
  }
  cache.set(tunnelId, { expires: Date.now() + ttl, value });
  return value;
}

type Stub = Record<string, { status?: unknown; since?: unknown }>;

function devStub(): Stub | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env[REMOTE_STUB_ENV]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stub) : null;
  } catch {
    return null;
  }
}

function stubbed(stub: Stub, storeId: string): Observation {
  const entry = stub[storeId] ?? stub["*"];
  if (!entry) return { status: "unknown", since: null };
  const status = entry.status === "online" || entry.status === "offline" ? entry.status : "unknown";
  return { status, since: status === "unknown" ? null : asDate(entry.since) };
}

/** Cloudflare's timestamp when it has one; else when this status was first observed, kept on the store. */
async function sinceFor(store: Doc, observed: Observation): Promise<Date | null> {
  if (observed.status === "unknown") return null;
  if (store.remoteStatus === observed.status) return observed.since ?? asDate(store.remoteStatusSince);
  const since = observed.since ?? new Date();
  await TenantStoreModel.updateOne(
    { storeId: store.storeId, remoteStatus: { $ne: observed.status } },
    { $set: { remoteStatus: observed.status, remoteStatusSince: since } }
  ).catch(() => undefined);
  return since;
}

/**
 * Remote reachability for stores (full store records), keyed by storeId.
 * Never throws: anything that goes wrong reads as `unknown`.
 */
export async function remoteStatuses(stores: Doc[]): Promise<Map<string, RemoteStatus>> {
  const result = new Map<string, RemoteStatus>();
  if (!stores.length) return result;
  try {
    await connectDb();
    const stub = devStub();
    const viaCloudflare = (store: Doc) => !stub && cloudflareConfigured() && Boolean(store.tunnelId) && Boolean(store.tunnelUrl);

    const heartbeatIds = stores.filter((store) => !stub && !viaCloudflare(store)).map((store) => String(store.storeId));
    const lastSeen = new Map<string, Date>();
    if (heartbeatIds.length) {
      const rows = (await WorkerInstallationModel.find({ storeId: { $in: heartbeatIds }, status: { $in: LIVE_INSTALL } })
        .select("storeId lastSeenAt")
        .lean()) as Doc[];
      for (const row of rows) {
        const seen = asDate(row.lastSeenAt);
        const storeId = String(row.storeId);
        if (seen && (!lastSeen.has(storeId) || seen > lastSeen.get(storeId)!)) lastSeen.set(storeId, seen);
      }
    }

    await Promise.all(
      stores.map(async (store) => {
        const storeId = String(store.storeId);
        let observed: Observation;
        if (stub) observed = stubbed(stub, storeId);
        else if (viaCloudflare(store)) observed = await cloudflareObservation(String(store.tunnelId));
        else {
          const seen = lastSeen.get(storeId);
          observed = seen && Date.now() - seen.getTime() <= HEARTBEAT_FRESH_MS ? { status: "online", since: null } : { status: "unknown", since: null };
        }
        result.set(storeId, { status: observed.status, since: minuteIso(await sinceFor(store, observed)) });
      })
    );
  } catch (error) {
    console.error("[remote-status]", error);
  }
  for (const store of stores) if (!result.has(String(store.storeId))) result.set(String(store.storeId), UNKNOWN);
  return result;
}

export async function remoteStatusOf(store: Doc): Promise<RemoteStatus> {
  return (await remoteStatuses([store])).get(String(store.storeId)) ?? UNKNOWN;
}
