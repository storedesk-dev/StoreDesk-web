import { createHmac, randomBytes } from "crypto";
import { after } from "next/server";
import { connectDb } from "@/lib/db";
import {
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";

/**
 * Control plane → store server nudge (docs/design/store-sign-in-and-sync.md,
 * "Notify the store"). After a change that affects a store's access, POST
 * `{tunnelUrl}/api/sync/v1/notify` to each affected installation; the store
 * answers 202 and pulls `GET /api/v1/edge/sync/access`. The notify carries no
 * data, so a missed one only delays the store until its daily pull.
 *
 * Signature: hex(HMAC-SHA256(key = UTF-8 bytes of the installation's relayKey
 * string, message = "{timestamp}.{workerInstallationId}.{nonce}")), timestamp in
 * unix seconds, nonce 16 random bytes base64url.
 */

export type NotifyReason =
  | "role.create"
  | "role.update"
  | "role.delete"
  | "app_user.create"
  | "app_user.update"
  | "app_user.enroll"
  | "app_user.disable"
  | "assignment.create"
  | "assignment.change"
  | "assignment.revoke"
  | "subscription.create"
  | "subscription.change"
  | "store.update"
  | "device.revoke";

export type NotifyInput = {
  organizationId: string;
  /** Narrow to these stores / installations; none given means the whole organization. */
  storeId?: string;
  storeIds?: string[];
  workerInstallationIds?: string[];
  /** The caller itself, when a store server made the change. */
  exceptInstallationId?: string;
  reason: NotifyReason;
};

export type NotifyTarget = { workerInstallationId: string; tunnelUrl: string; relayKey: string };

export type NotifyOutcome = {
  workerInstallationId: string;
  ok: boolean;
  status?: number;
  error?: string;
};

export type NotifyDeps = {
  fetch?: typeof fetch;
  loadTargets?: (input: NotifyInput) => Promise<NotifyTarget[]>;
  now?: () => number;
  nonce?: () => string;
  timeoutMs?: number;
};

export const NOTIFY_PATH = "/api/sync/v1/notify";
export const NOTIFY_TIMEOUT_MS = 3_000;
const ACTIVE_INSTALLATION = ["active", "degraded"];

export function signNotify(
  relayKey: string,
  timestamp: string,
  workerInstallationId: string,
  nonce: string
): string {
  return createHmac("sha256", relayKey)
    .update(`${timestamp}.${workerInstallationId}.${nonce}`, "utf8")
    .digest("hex");
}

export function newNotifyNonce(): string {
  return randomBytes(16).toString("base64url");
}

function notifyUrl(tunnelUrl: string): string | null {
  try {
    const url = new URL(tunnelUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}${NOTIFY_PATH}`;
  } catch {
    return null;
  }
}

/** Active installations in scope whose store has a tunnel URL and that hold an active credential. */
export async function loadNotifyTargets(input: NotifyInput): Promise<NotifyTarget[]> {
  await connectDb();
  const filter: Record<string, unknown> = {
    organizationId: input.organizationId,
    status: { $in: ACTIVE_INSTALLATION }
  };
  const storeIds = [...(input.storeIds ?? []), ...(input.storeId ? [input.storeId] : [])];
  const installationIds = input.workerInstallationIds ?? [];
  const scopes: Record<string, unknown>[] = [];
  if (storeIds.length) scopes.push({ storeId: { $in: storeIds } });
  if (installationIds.length) scopes.push({ workerInstallationId: { $in: installationIds } });
  if (scopes.length) filter.$or = scopes;
  if (input.exceptInstallationId) filter.workerInstallationId = { $ne: input.exceptInstallationId };

  const installations = (await WorkerInstallationModel.find(filter).lean()) as Array<
    Record<string, unknown>
  >;
  if (installations.length === 0) return [];
  const ids = installations.map((installation) => String(installation.workerInstallationId));
  const [credentials, stores] = (await Promise.all([
    WorkerCredentialModel.find({ workerInstallationId: { $in: ids }, status: "active" })
      .select("+relayKey")
      .lean(),
    TenantStoreModel.find({
      organizationId: input.organizationId,
      storeId: { $in: [...new Set(installations.map((i) => String(i.storeId)))] }
    }).lean()
  ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];

  const relayKeys = new Map(
    credentials.map((credential) => [String(credential.workerInstallationId), credential.relayKey])
  );
  const tunnels = new Map(stores.map((store) => [String(store.storeId), store.tunnelUrl]));
  const targets: NotifyTarget[] = [];
  for (const installation of installations) {
    const workerInstallationId = String(installation.workerInstallationId);
    const relayKey = relayKeys.get(workerInstallationId);
    const tunnelUrl = tunnels.get(String(installation.storeId));
    if (typeof relayKey === "string" && relayKey && typeof tunnelUrl === "string" && tunnelUrl) {
      targets.push({ workerInstallationId, tunnelUrl, relayKey });
    }
  }
  return targets;
}

async function notifyOne(
  target: NotifyTarget,
  reason: NotifyReason,
  deps: Required<Omit<NotifyDeps, "loadTargets">>
): Promise<NotifyOutcome> {
  const { workerInstallationId } = target;
  const url = notifyUrl(target.tunnelUrl);
  if (!url) return { workerInstallationId, ok: false, error: "INVALID_TUNNEL_URL" };
  const timestamp = String(Math.floor(deps.now() / 1000));
  const nonce = deps.nonce();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  try {
    const response = await deps.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-StoreDesk-Timestamp": timestamp,
        "X-StoreDesk-Signature": signNotify(target.relayKey, timestamp, workerInstallationId, nonce)
      },
      body: JSON.stringify({ workerInstallationId, nonce, reason }),
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store"
    });
    return { workerInstallationId, ok: response.status >= 200 && response.status < 300, status: response.status };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return { workerInstallationId, ok: false, error: name === "AbortError" ? "TIMEOUT" : name };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Notify every affected installation. Never throws and never rejects: failures
 * are logged (installation id, reason, status or error class — never the relay
 * key or the signature) and returned for tests.
 */
export async function notifyInstallations(
  input: NotifyInput,
  deps: NotifyDeps = {}
): Promise<NotifyOutcome[]> {
  try {
    const targets = await (deps.loadTargets ?? loadNotifyTargets)(input);
    const resolved = {
      fetch: deps.fetch ?? fetch,
      now: deps.now ?? Date.now,
      nonce: deps.nonce ?? newNotifyNonce,
      timeoutMs: deps.timeoutMs ?? NOTIFY_TIMEOUT_MS
    };
    const outcomes = await Promise.all(
      targets.map((target) => notifyOne(target, input.reason, resolved))
    );
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        console.warn(
          `[store-notify] ${input.reason} → ${outcome.workerInstallationId} failed: ${
            outcome.status ?? outcome.error
          }`
        );
      }
    }
    return outcomes;
  } catch (error) {
    console.warn(
      `[store-notify] ${input.reason} for ${input.organizationId} could not run: ${
        error instanceof Error ? error.name : "Error"
      }`
    );
    return [];
  }
}

/**
 * Every installation an app user can currently sign in at, by their active
 * assignments. For a revoked assignment the user no longer has it, so a future
 * revoke path must call `notifyInstallations` with that assignment's scope.
 */
export async function notifyAppUserInstallations(
  appUserId: string,
  reason: NotifyReason,
  deps: NotifyDeps = {}
): Promise<NotifyOutcome[]> {
  try {
    await connectDb();
    const assignments = (await UserAssignmentModel.find({ appUserId, status: "active" }).lean()) as Array<
      Record<string, unknown>
    >;
    const byOrganization = new Map<string, { wholeOrg: boolean; storeIds: Set<string>; ids: Set<string> }>();
    for (const assignment of assignments) {
      const organizationId = String(assignment.organizationId ?? "");
      if (!organizationId) continue;
      const scope =
        byOrganization.get(organizationId) ?? { wholeOrg: false, storeIds: new Set(), ids: new Set() };
      if (assignment.workerInstallationId) scope.ids.add(String(assignment.workerInstallationId));
      else if (assignment.storeId) scope.storeIds.add(String(assignment.storeId));
      else scope.wholeOrg = true;
      byOrganization.set(organizationId, scope);
    }
    const results = await Promise.all(
      [...byOrganization].map(([organizationId, scope]) =>
        notifyInstallations(
          scope.wholeOrg
            ? { organizationId, reason }
            : { organizationId, reason, storeIds: [...scope.storeIds], workerInstallationIds: [...scope.ids] },
          deps
        )
      )
    );
    return results.flat();
  } catch (error) {
    console.warn(
      `[store-notify] ${reason} for an app user could not run: ${error instanceof Error ? error.name : "Error"}`
    );
    return [];
  }
}

/**
 * Run after the response is sent (`after()` keeps the function alive on
 * Vercel), so an admin request never waits on a store. Outside a request scope
 * (tests, scripts) it simply runs detached.
 */
export function runAfterResponse(task: () => Promise<unknown>): void {
  const guarded = () => task().catch(() => undefined);
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

export function scheduleNotify(input: NotifyInput): void {
  runAfterResponse(() => notifyInstallations(input));
}

export function scheduleAppUserNotify(appUserId: string, reason: NotifyReason): void {
  runAfterResponse(() => notifyAppUserInstallations(appUserId, reason));
}
