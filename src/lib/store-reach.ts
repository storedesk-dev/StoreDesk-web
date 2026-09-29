import { connectDb } from "@/lib/db";
import { productFilter, STOREDESK } from "@/lib/products";
import { remoteStatuses, type RemoteStatus } from "@/lib/remote-status";
import { WorkerInstallationModel } from "@/models/ControlPlane";

/**
 * How a phone reaches a store, and whether it can yet — the three facts the
 * old org-tag lookup and the email sign-in's store list both answer, computed
 * once here so the two never disagree.
 *
 * - `tunnelUrl`: the store's public hostname, or null when it has no remote access.
 * - `setup`: whether a StoreDesk PC has been activated for it. A store still
 *   waiting for its PC is shown disabled ("Not set up yet"), not hidden.
 * - `remote`: whether phones can reach it now, and since when (`lib/remote-status.ts`).
 *
 * Only public facts: nothing about the PC beyond "is there one".
 */

type Doc = Record<string, unknown>;

export type StoreSetup = "active" | "awaiting_activation" | "none";

export interface StoreReach {
  readonly tunnelUrl: string | null;
  readonly setup: StoreSetup;
  readonly remote: RemoteStatus;
}

const UNKNOWN: RemoteStatus = { status: "unknown", since: null };

/** Keyed by storeId; every store passed in gets an answer. Takes full store records. */
export async function storeReach(stores: readonly Doc[]): Promise<Map<string, StoreReach>> {
  const result = new Map<string, StoreReach>();
  if (!stores.length) return result;
  await connectDb();

  const storeIds = stores.map((store) => String(store.storeId));
  const [remote, installations] = (await Promise.all([
    remoteStatuses([...stores]),
    WorkerInstallationModel.find({ storeId: { $in: storeIds }, ...productFilter(STOREDESK) })
      .select({ storeId: 1, status: 1 })
      .lean()
  ])) as [Map<string, RemoteStatus>, Doc[]];

  const setupOf = (storeId: string): StoreSetup => {
    const mine = installations.filter((row) => String(row.storeId) === storeId).map((row) => String(row.status));
    if (mine.includes("active")) return "active";
    if (mine.includes("awaiting_activation")) return "awaiting_activation";
    return "none";
  };

  for (const store of stores) {
    const storeId = String(store.storeId);
    result.set(storeId, {
      tunnelUrl: store.tunnelUrl ? String(store.tunnelUrl) : null,
      setup: setupOf(storeId),
      remote: remote.get(storeId) ?? UNKNOWN
    });
  }
  return result;
}
