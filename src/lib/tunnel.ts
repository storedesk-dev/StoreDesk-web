import { connectDb } from "@/lib/db";
import { deleteCloudflareTunnel, provisionCloudflareTunnel, rotateCloudflareTunnel } from "@/lib/cloudflare";
import { TenantStoreModel } from "@/models/ControlPlane";
import { scheduleNotify } from "@/lib/store-notify";

/**
 * A store's Cloudflare tunnel: how phones reach the store server. The outcome
 * of provisioning is recorded on the store and shown with a Retry (P6).
 *
 * - `ok`              the store has a tunnel URL
 * - `not_configured`  this deployment has no Cloudflare credentials
 * - `failed`          Cloudflare refused; `message` says why
 * - `missing`         never attempted (stores from older builds)
 *
 * `rotationRequired`: the store's PC was replaced and the tunnel's secret
 * could not be rotated yet, so the old PC could still serve it. No setup key
 * is issued until "Retry tunnel" rotates it.
 */
export type TunnelStatus = "ok" | "not_configured" | "failed" | "missing";

export type TunnelView = {
  status: TunnelStatus;
  url: string | null;
  label: string | null;
  message: string | null;
  updatedAt: string | null;
  rotationRequired: boolean;
};

export const TUNNEL_NOT_CONFIGURED_MESSAGE =
  "Cloudflare is not configured on this deployment (CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are unset), so no tunnel was created. Phones cannot reach this store until one is.";

const ROTATION_REQUIRED_MESSAGE =
  "This store's PC was replaced. Rotate the tunnel (Retry) so the old PC can no longer serve it, then issue a setup key.";

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim());
}

/**
 * Turn anything an operator types into a valid DNS label: lowercase letters,
 * digits and hyphens, no leading or trailing hyphen, at most 63 characters.
 */
export function toDnsLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function tunnelView(store: Record<string, unknown>): TunnelView {
  const url = str(store.tunnelUrl);
  const rotationRequired = store.tunnelRotationRequired === true;
  let status: TunnelStatus;
  if (url) status = "ok";
  else if (!cloudflareConfigured()) status = "not_configured";
  else if (store.tunnelStatus === "failed") status = "failed";
  else status = "missing";
  return {
    status,
    url,
    label: str(store.tunnelLabel),
    message:
      rotationRequired
        ? ROTATION_REQUIRED_MESSAGE
        : status === "failed"
          ? (str(store.tunnelError) ?? "Tunnel creation failed")
          : status === "not_configured"
            ? TUNNEL_NOT_CONFIGURED_MESSAGE
            : status === "missing"
              ? "This store has no tunnel yet."
              : null,
    updatedAt: store.tunnelUpdatedAt instanceof Date ? store.tunnelUpdatedAt.toISOString() : null,
    rotationRequired
  };
}

export type EdgeTunnelState = "active" | "deleted" | "none";

/**
 * What the store server is told about its tunnel in the config sync
 * (`tunnel.state`): `active` — it has a token and URL; `deleted` — it had a
 * tunnel and it is gone, so clear the token and stop the tunnel; `none` —
 * never had one, or it could not be provisioned. Only `active` carries the
 * token and URL.
 */
export function edgeTunnelState(store: Record<string, unknown>): EdgeTunnelState {
  if (str(store.tunnelUrl) && str(store.cloudflareToken)) return "active";
  if (store.tunnelDeletedAt || str(store.tunnelId) || store.tunnelRotatedAt) return "deleted";
  return "none";
}

/** Whether another store already holds this hostname label. */
export async function tunnelLabelInUse(label: string, exceptStoreId: string): Promise<boolean> {
  await connectDb();
  return Boolean(await TenantStoreModel.exists({ tunnelLabel: label, storeId: { $ne: exceptStoreId } }));
}

/** `base`, or `base-2`, `base-3`, … — the first no other store holds. */
export async function freeTunnelLabel(base: string, storeId: string): Promise<string> {
  let label = base;
  for (let n = 2; await tunnelLabelInUse(label, storeId); n += 1) {
    const suffix = `-${n}`;
    label = `${base.slice(0, 63 - suffix.length).replace(/-+$/, "")}${suffix}`;
  }
  return label;
}

export type TunnelOutcome = { status: Exclude<TunnelStatus, "missing">; url: string | null; message: string | null };

/**
 * Delete a store's tunnel and DNS record by their stored Cloudflare ids.
 * A tunnel from an older build has only a name, and deleting by name could
 * remove another store's tunnel, so it is left alone and named in
 * `manualCleanup` for an operator (as is one Cloudflare refused to delete).
 */
export async function removeStoreTunnel(
  store: Record<string, unknown>
): Promise<{ tunnelDeleted: boolean; manualCleanup: string | null }> {
  const tunnelId = str(store.tunnelId);
  if (tunnelId) {
    const result = await deleteCloudflareTunnel({ tunnelId, dnsRecordId: str(store.tunnelDnsRecordId) });
    const storeId = str(store.storeId);
    if (result.tunnelDeleted && storeId) {
      // The store (if it remains) is told plainly: its tunnel is gone.
      await TenantStoreModel.updateOne(
        { storeId },
        {
          $set: { tunnelDeletedAt: new Date(), tunnelUpdatedAt: new Date() },
          $unset: { tunnelUrl: 1, cloudflareToken: 1, tunnelId: 1, tunnelDnsRecordId: 1, tunnelRotationRequired: 1 }
        }
      );
      const organizationId = str(store.organizationId);
      if (organizationId) scheduleNotify({ organizationId, storeId, reason: "tunnel.delete" });
    }
    return { tunnelDeleted: result.tunnelDeleted, manualCleanup: result.tunnelDeleted ? null : (str(store.tunnelLabel) ?? tunnelId) };
  }
  const url = str(store.tunnelUrl);
  if (!url) return { tunnelDeleted: false, manualCleanup: null };
  let label = str(store.tunnelLabel);
  if (!label) {
    try {
      label = new URL(url).hostname.split(".")[0] || url;
    } catch {
      label = url;
    }
  }
  return { tunnelDeleted: false, manualCleanup: label };
}

/**
 * Create the tunnel and record the outcome on the store. The label, tunnel id
 * and DNS record id are saved only when it succeeded. Never throws for a
 * Cloudflare failure.
 */
export async function provisionStoreTunnel(storeId: string, label: string): Promise<TunnelOutcome> {
  await connectDb();
  const now = new Date();
  if (!cloudflareConfigured()) {
    await TenantStoreModel.updateOne(
      { storeId },
      { $set: { tunnelStatus: "not_configured", tunnelUpdatedAt: now }, $unset: { tunnelError: 1 } }
    );
    return { status: "not_configured", url: null, message: TUNNEL_NOT_CONFIGURED_MESSAGE };
  }
  try {
    const created = await provisionCloudflareTunnel(storeId, label);
    if (!created) {
      await TenantStoreModel.updateOne({ storeId }, { $set: { tunnelStatus: "not_configured", tunnelUpdatedAt: now } });
      return { status: "not_configured", url: null, message: TUNNEL_NOT_CONFIGURED_MESSAGE };
    }
    await TenantStoreModel.updateOne(
      { storeId },
      {
        $set: {
          tunnelStatus: "provisioned",
          tunnelUrl: created.tunnelUrl,
          cloudflareToken: created.cloudflareToken,
          tunnelLabel: label,
          tunnelId: created.tunnelId,
          ...(created.dnsRecordId ? { tunnelDnsRecordId: created.dnsRecordId } : {}),
          tunnelUpdatedAt: now
        },
        $unset: {
          tunnelError: 1,
          tunnelRotationRequired: 1,
          ...(created.dnsRecordId ? {} : { tunnelDnsRecordId: 1 })
        }
      }
    );
    return { status: "ok", url: created.tunnelUrl, message: null };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    console.error(`[cloudflare-provision] ${storeId}: ${message}`);
    await TenantStoreModel.updateOne(
      { storeId },
      { $set: { tunnelStatus: "failed", tunnelError: message, tunnelUpdatedAt: now } }
    );
    return { status: "failed", url: null, message };
  }
}

/**
 * Rotate the store's tunnel secret (the store must have a tunnel id). On
 * success the new token is stored — the next PC receives it at activation —
 * and `tunnelRotationRequired` is cleared. Never throws for a Cloudflare failure.
 */
export async function rotateStoreTunnel(storeId: string, tunnelId: string): Promise<TunnelOutcome> {
  await connectDb();
  if (!cloudflareConfigured()) return { status: "not_configured", url: null, message: TUNNEL_NOT_CONFIGURED_MESSAGE };
  try {
    const { cloudflareToken } = await rotateCloudflareTunnel(tunnelId);
    const now = new Date();
    const store = await TenantStoreModel.findOneAndUpdate(
      { storeId },
      {
        $set: { cloudflareToken, tunnelStatus: "provisioned", tunnelRotatedAt: now, tunnelUpdatedAt: now },
        $unset: { tunnelRotationRequired: 1, tunnelError: 1 }
      },
      { returnDocument: "after" }
    ).lean();
    return { status: "ok", url: store?.tunnelUrl ? String(store.tunnelUrl) : null, message: null };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    console.error(`[cloudflare-rotate] ${storeId}: ${message}`);
    return { status: "failed", url: null, message };
  }
}
