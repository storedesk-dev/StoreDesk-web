import { createSign } from "node:crypto";
import { ControlPlaneError } from "@/lib/control-plane-security";

/**
 * StoreDesk's one Google account (owner decision 2): a service account whose
 * key lives only here, in env `GOOGLE_SERVICE_ACCOUNT_JSON` (the downloaded
 * key file, raw JSON or base64). Store owners share their sheet with its
 * address; a store PC never holds the key — it asks for a short-lived access
 * token (`POST /api/v1/edge/google/access-token`).
 *
 * Tokens are minted with the OAuth 2.0 JWT bearer flow (RFC 7523) using node
 * crypto: an RS256-signed assertion exchanged at the key's token_uri.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly"
];
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
/** A cached token is reused while it has at least this long left. */
const REUSE_MARGIN_MS = 5 * 60_000;

type ServiceAccount = { clientEmail: string; privateKey: string; tokenUri: string };

export function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    if (typeof json.client_email !== "string" || typeof json.private_key !== "string") return null;
    const tokenUri = typeof json.token_uri === "string" && json.token_uri.startsWith("https://")
      ? json.token_uri
      : DEFAULT_TOKEN_URI;
    return {
      clientEmail: json.client_email,
      // A key pasted into an env var often arrives with literal "\n".
      privateKey: json.private_key.replace(/\\n/g, "\n"),
      tokenUri
    };
  } catch {
    return null;
  }
}

export function googleServiceAccountEmail(): string | null {
  return loadServiceAccount()?.clientEmail ?? null;
}

export function requireServiceAccount(): ServiceAccount {
  const account = loadServiceAccount();
  if (!account) {
    throw new ControlPlaneError(
      503,
      "GOOGLE_NOT_CONFIGURED",
      "Google Sheets is not configured on this deployment: GOOGLE_SERVICE_ACCOUNT_JSON is missing or is not a service-account key"
    );
  }
  return account;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** The RS256 JWT the token endpoint exchanges for an access token. */
export function signJwtAssertion(account: ServiceAccount, scopes: string[], nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: scopes.join(" "),
      aud: account.tokenUri,
      iat: nowSeconds,
      exp: nowSeconds + 3600
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(account.privateKey, "base64url")}`;
}

type CachedToken = { clientEmail: string; accessToken: string; expiresAt: number };
const cacheHolder = globalThis as unknown as { __sdGoogleToken?: CachedToken };

export function resetGoogleTokenCacheForTests(): void {
  cacheHolder.__sdGoogleToken = undefined;
}

export type GoogleAccessToken = { accessToken: string; expiresAt: string; clientEmail: string; scopes: string[] };

export async function mintGoogleAccessToken(now = Date.now()): Promise<GoogleAccessToken> {
  const account = requireServiceAccount();
  const cached = cacheHolder.__sdGoogleToken;
  if (cached && cached.clientEmail === account.clientEmail && cached.expiresAt - now > REUSE_MARGIN_MS) {
    return {
      accessToken: cached.accessToken,
      expiresAt: new Date(cached.expiresAt).toISOString(),
      clientEmail: account.clientEmail,
      scopes: GOOGLE_SCOPES
    };
  }
  let assertion: string;
  try {
    assertion = signJwtAssertion(account, GOOGLE_SCOPES, Math.floor(now / 1000));
  } catch {
    throw new ControlPlaneError(503, "GOOGLE_NOT_CONFIGURED", "The Google service-account private key cannot sign");
  }
  let response: Response;
  try {
    response = await fetch(account.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      }).toString(),
      cache: "no-store"
    });
  } catch {
    throw new ControlPlaneError(502, "GOOGLE_UNAVAILABLE", "Google could not be reached", true);
  }
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new ControlPlaneError(
      502,
      "GOOGLE_UNAVAILABLE",
      `Google refused the StoreDesk service account: ${data.error_description || data.error || response.status}`,
      true
    );
  }
  const expiresAt = now + Math.max(60, Number(data.expires_in) || 3600) * 1000;
  cacheHolder.__sdGoogleToken = { clientEmail: account.clientEmail, accessToken: data.access_token, expiresAt };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(expiresAt).toISOString(),
    clientEmail: account.clientEmail,
    scopes: GOOGLE_SCOPES
  };
}

export type SpreadsheetCheck = { clientEmail: string; spreadsheetId: string; title: string; sheets: string[] };

/**
 * Can StoreDesk's account open the sheet? Answers its title and tab names.
 * A sheet that is not shared (403) or does not exist (404) is 422 with the
 * address to share it with.
 */
export async function checkSpreadsheet(spreadsheetId: string): Promise<SpreadsheetCheck> {
  const token = await mintGoogleAccessToken();
  const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(
    "properties.title,sheets.properties.title"
  )}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` }, cache: "no-store" });
  } catch {
    throw new ControlPlaneError(502, "GOOGLE_UNAVAILABLE", "Google Sheets could not be reached", true);
  }
  if (response.status === 403 || response.status === 404) {
    const notShared = response.status === 403;
    throw new ControlPlaneError(
      422,
      notShared ? "SHEET_NOT_SHARED" : "SHEET_NOT_FOUND",
      notShared
        ? `StoreDesk can't open this sheet. Share it with ${token.clientEmail} and check again.`
        : `No sheet at that link, or it isn't shared with ${token.clientEmail}.`,
      false,
      { clientEmail: token.clientEmail, spreadsheetId }
    );
  }
  if (!response.ok) {
    throw new ControlPlaneError(502, "GOOGLE_UNAVAILABLE", `Google Sheets answered ${response.status}`, true);
  }
  const data = (await response.json().catch(() => ({}))) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return {
    clientEmail: token.clientEmail,
    spreadsheetId,
    title: data.properties?.title ?? "",
    sheets: (data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === "string")
  };
}
