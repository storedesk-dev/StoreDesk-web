import { connectDb } from "@/lib/db";
import { provisionCloudflareTunnel } from "@/lib/cloudflare";
import { TenantStoreModel } from "@/models/ControlPlane";

/**
 * A store's Cloudflare tunnel: how phones reach the store server. Provisioning
 * used to fail silently; the outcome is now recorded on the store and shown
 * with a Retry (P6).
 *
 * - `ok`              the store has a tunnel URL
 * - `not_configured`  this deployment has no Cloudflare credentials, so no
 *                     tunnel can be made (local runs, previews)
 * - `failed`          Cloudflare refused; `message` says why
 * - `missing`         never attempted (stores from older builds)
 */
export type TunnelStatus = "ok" | "not_configured" | "failed" | "missing";

export type TunnelView = {
  status: TunnelStatus;
  url: string | null;
  label: string | null;
  message: string | null;
  updatedAt: string | null;
};

export const TUNNEL_NOT_CONFIGURED_MESSAGE =
  "Cloudflare is not configured on this deployment (CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are unset), so no tunnel was created. Phones cannot reach this store until one is.";

export function cloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ACCOUNT_ID?.trim());
}

/**
 * Turn anything an operator types into a valid DNS label.
 *
 * The tunnel hostname is `<label>.<tunnel domain>`. Labels are lowercase
 * letters, digits and hyphens, no leading or trailing hyphen, at most 63
 * characters (RFC 1035) — a generated `store_<hex>` id is not one.
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
      status === "failed"
        ? (str(store.tunnelError) ?? "Tunnel creation failed")
        : status === "not_configured"
          ? TUNNEL_NOT_CONFIGURED_MESSAGE
          : status === "missing"
            ? "This store has no tunnel yet."
            : null,
    updatedAt: store.tunnelUpdatedAt instanceof Date ? store.tunnelUpdatedAt.toISOString() : null
  };
}

export type TunnelOutcome = { status: Exclude<TunnelStatus, "missing">; url: string | null; message: string | null };

/** Create the tunnel and record the outcome on the store. Never throws for a Cloudflare failure. */
export async function provisionStoreTunnel(storeId: string, label: string): Promise<TunnelOutcome> {
  await connectDb();
  const now = new Date();
  const record = async (fields: Record<string, unknown>, unset: string[] = []) => {
    await TenantStoreModel.updateOne(
      { storeId },
      {
        $set: { ...fields, tunnelLabel: label, tunnelUpdatedAt: now },
        ...(unset.length ? { $unset: Object.fromEntries(unset.map((key) => [key, 1])) } : {})
      }
    );
  };

  if (!cloudflareConfigured()) {
    await record({ tunnelStatus: "not_configured" }, ["tunnelError"]);
    return { status: "not_configured", url: null, message: TUNNEL_NOT_CONFIGURED_MESSAGE };
  }
  try {
    const created = await provisionCloudflareTunnel(storeId, label);
    if (!created) {
      await record({ tunnelStatus: "not_configured" }, ["tunnelError"]);
      return { status: "not_configured", url: null, message: TUNNEL_NOT_CONFIGURED_MESSAGE };
    }
    await record(
      { tunnelStatus: "provisioned", tunnelUrl: created.tunnelUrl, cloudflareToken: created.cloudflareToken },
      ["tunnelError"]
    );
    return { status: "ok", url: created.tunnelUrl, message: null };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    console.error(`[cloudflare-provision] ${storeId}: ${message}`);
    await record({ tunnelStatus: "failed", tunnelError: message });
    return { status: "failed", url: null, message };
  }
}
