import crypto from "crypto";

export async function provisionCloudflareTunnel(storeId: string, tunnelSlug: string): Promise<{
  cloudflareToken: string;
  tunnelUrl: string;
} | null> {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

  if (!token || !accountId) {
    console.info("[cloudflare] Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID. Skipping tunnel creation.");
    return null;
  }

  const tunnelName = tunnelSlug;
  // Generate a cryptographically secure 32-byte secret for the tunnel
  const tunnelSecret = crypto.randomBytes(32).toString("base64");

  console.info(`[cloudflare] Provisioning tunnel "${tunnelName}"...`);

  // 1. Create the Tunnel via API
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: tunnelName,
      config_src: "cloudflare",
      tunnel_secret: tunnelSecret
    })
  });

  const data = (await res.json()) as { success?: boolean; result?: { id?: string; token?: string }; errors?: Array<{ message?: string }> };
  if (!res.ok || !data.success) {
    const errMsg = data.errors?.[0]?.message || "Failed to create Cloudflare tunnel";
    throw new Error(errMsg);
  }

  const tunnelId = data.result?.id;
  const tunnelToken = data.result?.token;

  if (!tunnelId || !tunnelToken) {
    throw new Error("Cloudflare did not return a valid tunnel ID or token.");
  }

  console.info(`[cloudflare] Tunnel created successfully. ID: ${tunnelId}`);

  const tunnelDomain = process.env.CLOUDFLARE_TUNNEL_DOMAIN?.trim() || "tunnels.storedesk.net";
  const tunnelUrl = `https://${tunnelSlug}.${tunnelDomain}`;

  // 2. Create the DNS record (CNAME) pointing to the tunnel if zone ID is provided
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (zoneId) {
    console.info(`[cloudflare] Creating DNS CNAME record for ${tunnelSlug}.${tunnelDomain}...`);
    try {
      const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "CNAME",
          name: `${tunnelSlug}.${tunnelDomain}`,
          content: `${tunnelId}.cfargotunnel.com`,
          ttl: 1,
          proxied: true
        })
      });

      const dnsData = (await dnsRes.json()) as { success?: boolean; errors?: Array<{ message?: string }> };
      if (!dnsRes.ok || !dnsData.success) {
        const errMsg = dnsData.errors?.[0]?.message || "Failed to create DNS CNAME record";
        console.warn(`[cloudflare:warn] CNAME registration warning: ${errMsg}`);
      } else {
        console.info("[cloudflare] DNS CNAME record registered successfully.");
      }
    } catch (dnsErr: unknown) {
      const msg = dnsErr instanceof Error ? dnsErr.message : String(dnsErr);
      console.warn(`[cloudflare:warn] Failed to create DNS record: ${msg}`);
    }
  }

  // 3. Configure the Tunnel routing (Published Application / Public Hostname)
  console.info(`[cloudflare] Configuring tunnel routing for ${tunnelSlug}.${tunnelDomain} -> http://localhost:4000 ...`);
  try {
    const configRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          ingress: [
            {
              hostname: `${tunnelSlug}.${tunnelDomain}`,
              service: "http://localhost:4000"
            },
            {
              service: "http_status:404"
            }
          ]
        }
      })
    });

    const configData = (await configRes.json()) as { success?: boolean; errors?: Array<{ message?: string }> };
    if (!configRes.ok || !configData.success) {
      const errMsg = configData.errors?.[0]?.message || "Failed to configure tunnel routing";
      console.warn(`[cloudflare:warn] Tunnel configuration warning: ${errMsg}`);
    } else {
      console.info("[cloudflare] Tunnel routing configured successfully.");
    }
  } catch (configErr: unknown) {
    const msg = configErr instanceof Error ? configErr.message : String(configErr);
    console.warn(`[cloudflare:warn] Failed to configure tunnel routing: ${msg}`);
  }

  return {
    cloudflareToken: tunnelToken,
    tunnelUrl
  };
}
