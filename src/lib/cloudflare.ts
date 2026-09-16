import crypto from "crypto";

/**
 * Cloudflare tunnels, one per store: how phones reach the store server.
 *
 * Everything after creation is by id — the tunnel id and the DNS record id
 * stored on the store when provisioning succeeded — never by name: labels
 * are chosen by operators, and a name lookup can match another store's tunnel.
 */

const API = "https://api.cloudflare.com/client/v4";

type CfResponse<T> = { success?: boolean; result?: T; errors?: Array<{ message?: string }> };

function credentials(): { token: string; accountId: string } | null {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  return token && accountId ? { token, accountId } : null;
}

async function cf<T>(token: string, path: string, init: { method: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal
  });
  const data = (await res.json().catch(() => ({}))) as CfResponse<T>;
  if (!res.ok || data.success === false) {
    throw new Error(data.errors?.[0]?.message || `Cloudflare answered ${res.status}`);
  }
  return data.result as T;
}

function newTunnelSecret(): string {
  return crypto.randomBytes(32).toString("base64");
}

function tunnelDomain(): string {
  return process.env.CLOUDFLARE_TUNNEL_DOMAIN?.trim() || "tunnels.storedesk.net";
}

export type CloudflareTunnelHealth = {
  /** `healthy` | `degraded` | `down` | `inactive` (Cloudflare's words). */
  status: string | null;
  connsActiveAt: string | null;
  connsInactiveAt: string | null;
  /** The oldest open connection, when Cloudflare lists them. */
  openedAt: string | null;
};

/** A tunnel's health, by its Cloudflare id. Null when Cloudflare is not configured. */
export async function getCloudflareTunnelHealth(tunnelId: string, signal?: AbortSignal): Promise<CloudflareTunnelHealth | null> {
  const creds = credentials();
  if (!creds) return null;
  const tunnel = await cf<{
    status?: string;
    conns_active_at?: string | null;
    conns_inactive_at?: string | null;
    connections?: Array<{ opened_at?: string }>;
  }>(creds.token, `/accounts/${creds.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}`, { method: "GET", signal });
  const opened = (tunnel?.connections ?? [])
    .map((connection) => connection.opened_at)
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .sort()[0];
  return {
    status: tunnel?.status ?? null,
    connsActiveAt: tunnel?.conns_active_at ?? null,
    connsInactiveAt: tunnel?.conns_inactive_at ?? null,
    openedAt: opened ?? null
  };
}

export type ProvisionedTunnel = {
  cloudflareToken: string;
  tunnelUrl: string;
  tunnelId: string;
  /** Null when no CLOUDFLARE_ZONE_ID is set (DNS managed outside StoreDesk). */
  dnsRecordId: string | null;
};

/**
 * Create the tunnel, its DNS record and its routing. All or nothing: if the
 * DNS record or the routing fails, what was created is deleted again and the
 * error is thrown. Null when Cloudflare is not configured.
 */
export async function provisionCloudflareTunnel(storeId: string, label: string): Promise<ProvisionedTunnel | null> {
  const creds = credentials();
  if (!creds) {
    console.info("[cloudflare] Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID. Skipping tunnel creation.");
    return null;
  }
  const { token, accountId } = creds;
  const hostname = `${label}.${tunnelDomain()}`;
  const created = await cf<{ id?: string; token?: string }>(token, `/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    body: { name: label, config_src: "cloudflare", tunnel_secret: newTunnelSecret() }
  });
  if (!created?.id || !created.token) throw new Error("Cloudflare did not return a tunnel id and token");
  const tunnelId = created.id;
  let dnsRecordId: string | null = null;
  try {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
    if (zoneId) {
      const record = await cf<{ id?: string }>(token, `/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: { type: "CNAME", name: hostname, content: `${tunnelId}.cfargotunnel.com`, ttl: 1, proxied: true }
      });
      if (!record?.id) throw new Error("Cloudflare did not return a DNS record id");
      dnsRecordId = record.id;
    }
    await cf(token, `/accounts/${accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`, {
      method: "PUT",
      body: { config: { ingress: [{ hostname, service: "http://localhost:4630" }, { service: "http_status:404" }] } }
    });
  } catch (error) {
    await deleteCloudflareTunnel({ tunnelId, dnsRecordId }).catch(() => undefined);
    throw error;
  }
  console.info(`[cloudflare] Tunnel ${tunnelId} created for ${storeId}.`);
  return { cloudflareToken: created.token, tunnelUrl: `https://${hostname}`, tunnelId, dnsRecordId };
}

/** Delete a tunnel and its DNS record by their ids. Never throws; says what was deleted. */
export async function deleteCloudflareTunnel(ids: {
  tunnelId: string;
  dnsRecordId?: string | null;
}): Promise<{ tunnelDeleted: boolean; dnsDeleted: boolean }> {
  const creds = credentials();
  if (!creds) return { tunnelDeleted: false, dnsDeleted: false };
  const { token, accountId } = creds;
  const tunnelPath = `/accounts/${accountId}/cfd_tunnel/${encodeURIComponent(ids.tunnelId)}`;
  let tunnelDeleted = false;
  let dnsDeleted = false;
  try {
    // A tunnel with live connections cannot be deleted; drop them first.
    await cf(token, `${tunnelPath}/connections`, { method: "DELETE" }).catch(() => undefined);
    await cf(token, tunnelPath, { method: "DELETE" });
    tunnelDeleted = true;
  } catch (error) {
    console.warn(`[cloudflare] Could not delete tunnel ${ids.tunnelId}: ${error instanceof Error ? error.message : error}`);
  }
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  // The hostname goes only with the tunnel. A store PC's cloudflared reconnects within seconds of its
  // connections being dropped, and Cloudflare will not delete a tunnel with live connections; deleting the
  // DNS record anyway left a healthy tunnel with no hostname, and the store's phones on error 1033
  // (hars.storedesk.net, 2026-09-16). Leaving both lets removeStoreTunnel hand the tunnel to an operator whole.
  if (tunnelDeleted && ids.dnsRecordId && zoneId) {
    try {
      await cf(token, `/zones/${zoneId}/dns_records/${encodeURIComponent(ids.dnsRecordId)}`, { method: "DELETE" });
      dnsDeleted = true;
    } catch (error) {
      console.warn(`[cloudflare] Could not delete DNS record ${ids.dnsRecordId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return { tunnelDeleted, dnsDeleted };
}

/**
 * Rotate a tunnel's secret so a token held by a replaced PC stops working:
 * set a new secret, drop the live connections (the old PC's), and fetch the
 * token for the new secret. Same tunnel, same hostname. Throws on failure.
 */
export async function rotateCloudflareTunnel(tunnelId: string): Promise<{ cloudflareToken: string }> {
  const creds = credentials();
  if (!creds) throw new Error("Cloudflare is not configured");
  const { token, accountId } = creds;
  const tunnelPath = `/accounts/${accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}`;
  await cf(token, tunnelPath, { method: "PATCH", body: { tunnel_secret: newTunnelSecret() } });
  await cf(token, `${tunnelPath}/connections`, { method: "DELETE" });
  const cloudflareToken = await cf<string>(token, `${tunnelPath}/token`, { method: "GET" });
  if (typeof cloudflareToken !== "string" || !cloudflareToken) throw new Error("Cloudflare did not return the new tunnel token");
  return { cloudflareToken };
}
