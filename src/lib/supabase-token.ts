import { createHmac, timingSafeEqual } from "node:crypto";
import { ControlPlaneError } from "@/lib/control-plane-security";

/**
 * The only place a Supabase token is minted.
 *
 * Supabase holds the lottery data; the control plane says who may read it (D-17). So one module
 * signs every token, with the project's JWT secret, and it can emit exactly one Postgres role:
 * `authenticated`. `service_role` is never reachable from here, whatever it is asked for — a
 * mis-minted token is then a token that can read one store, not one that can read everything.
 *
 * Claims live under `sd` so nothing collides with what Supabase reserves for itself:
 *
 *   device — a lottery PC, proved by its worker credential, bound to one store
 *   user   — a person, proved by their password, carrying the stores and pages their role grants
 *
 * Short lives on purpose: a device hour, a person fifteen minutes. Revoking somebody writes a row
 * in `app.revocation`, which every RLS policy reads, so the token in their hand stops working in
 * seconds rather than when it expires.
 */

const ISSUER = "https://storedesk.net";
export const DEVICE_TTL_SECONDS = 60 * 60;
export const USER_TTL_SECONDS = 15 * 60;

export type SupabaseClaims =
  | {
      kind: "device";
      org: string;
      store: string;
      sub: string;
      lic?: string;
    }
  | {
      kind: "user";
      org: string;
      user: string;
      email: string;
      stores: string[];
      pages: string[];
    };

function secret(): string {
  const value = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new ControlPlaneError(503, "CLOUD_UNAVAILABLE", "The lottery cloud is not configured", true);
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_JWT_SECRET?.trim() && process.env.SUPABASE_URL?.trim());
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * Sign one token. `role` is the literal `authenticated` every time; it is not an argument, so no
 * caller can ask for anything else.
 */
export function mintSupabaseToken(claims: SupabaseClaims, ttlSeconds?: number): { token: string; expiresAt: Date } {
  const ttl = ttlSeconds ?? (claims.kind === "device" ? DEVICE_TTL_SECONDS : USER_TTL_SECONDS);
  const now = Math.floor(Date.now() / 1000);
  const subject = claims.kind === "device" ? claims.sub : claims.user;

  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: ISSUER,
    aud: "authenticated",
    role: "authenticated",
    sub: subject,
    iat: now,
    exp: now + ttl,
    sd: claims
  });
  const signature = createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date((now + ttl) * 1000) };
}

/** Read a token back — for tests, and for the one admin screen that explains what a PC can reach. */
export function readSupabaseToken(token: string): { claims: SupabaseClaims; expiresAt: Date; role: string } {
  const [header, payload, signature] = token.split(".");
  const invalid = new ControlPlaneError(401, "TOKEN_INVALID", "That token is not valid");
  if (!header || !payload || !signature) throw invalid;

  const expected = createHmac("sha256", secret()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid;

  const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    role: string;
    exp: number;
    sd: SupabaseClaims;
  };
  if (body.exp * 1000 <= Date.now()) throw new ControlPlaneError(401, "TOKEN_EXPIRED", "That token has expired");
  return { claims: body.sd, expiresAt: new Date(body.exp * 1000), role: body.role };
}
