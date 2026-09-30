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
 * There is one principal: a **person**, proved by their password (D-26). A lottery PC has no
 * credential of its own any more, so there is no device token to mint; the PC works as whoever
 * signed in on it, and its id rides along as `pc`, set only for a PC bound on the control plane.
 *
 * Claims live under `sd` so nothing collides with what Supabase reserves for itself. Every token
 * names exactly one store, and `stores` is `[store]`: a person with several stores gets one token
 * per store they work in. `pages` is always in the lottery app's words, whichever app asked — a
 * phone's `mobileLottery*` keys are mapped here, so the database checks one vocabulary. Android and
 * iOS take the same token.
 *
 * Fifteen minutes, on purpose. The claims are rebuilt from Mongo on every refresh, and revoking
 * somebody writes a row in `app.revocation`, which every RLS policy reads, so the token in their
 * hand stops working in seconds rather than when it expires.
 */

const ISSUER = "https://storedesk.net";
export const USER_TTL_SECONDS = 15 * 60;

/** The five pages the lottery cloud knows. */
export const LOTTERY_PAGE_KEYS = ["lottery", "lotteryClose", "lotteryCorrect", "lotteryReports", "lotterySettings"] as const;
export type LotteryPage = (typeof LOTTERY_PAGE_KEYS)[number];
const LOTTERY_PAGE_SET = new Set<string>(LOTTERY_PAGE_KEYS);

/**
 * A phone's lottery keys, in the lottery app's words. A phone never gets `lotteryCorrect` or
 * `lotterySettings`: there is no key here that maps to them.
 */
export const MOBILE_TO_LOTTERY: Readonly<Record<string, LotteryPage>> = {
  mobileLotteryRack: "lottery",
  mobileLotteryInventory: "lottery",
  mobileLotteryClose: "lotteryClose",
  mobileLotteryReports: "lotteryReports",
  mobileLotteryAnalytics: "lotteryReports"
};

export type TokenApp = "lottery" | "mobile";

/** What a token says about its person. Built here, never handed in whole by a caller. */
export type SupabaseClaims = {
  kind: "user";
  app: TokenApp;
  user: string;
  email: string;
  store: string;
  stores: [string];
  pc?: string;
  pages: LotteryPage[];
};

export type PersonTokenInput = {
  app: TokenApp;
  appUserId: string;
  email: string;
  storeId: string;
  /** Only for a lottery PC bound on the control plane. Ignored for a phone. */
  pcId?: string | null;
  /** The role's enabled keys, in the asking app's words. */
  pages: readonly string[];
};

/**
 * The role's keys in lottery words. For the lottery app they are its own keys, anything else
 * dropped; for a phone the mobile keys are mapped. Sorted and unique, so a token is stable.
 */
export function lotteryWords(app: TokenApp, pages: readonly string[]): LotteryPage[] {
  const out = new Set<LotteryPage>();
  for (const key of pages) {
    if (app === "mobile") {
      const mapped = MOBILE_TO_LOTTERY[key];
      if (mapped) out.add(mapped);
    } else if (LOTTERY_PAGE_SET.has(key)) {
      out.add(key as LotteryPage);
    }
  }
  return LOTTERY_PAGE_KEYS.filter((key) => out.has(key));
}

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
 * Sign one token for one person at one store. `role` is the literal `authenticated` every time; it
 * is not an argument, so no caller can ask for anything else.
 */
export function mintSupabaseToken(input: PersonTokenInput, ttlSeconds = USER_TTL_SECONDS): { token: string; expiresAt: Date } {
  if (!input.appUserId || !input.storeId) {
    throw new ControlPlaneError(500, "TOKEN_INVALID", "A token needs a person and a store");
  }
  const claims: SupabaseClaims = {
    kind: "user",
    app: input.app,
    user: input.appUserId,
    email: input.email.toLowerCase(),
    store: input.storeId,
    stores: [input.storeId],
    ...(input.app === "lottery" && input.pcId ? { pc: input.pcId } : {}),
    pages: lotteryWords(input.app, input.pages)
  };
  const now = Math.floor(Date.now() / 1000);

  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: ISSUER,
    aud: "authenticated",
    role: "authenticated",
    sub: claims.user,
    iat: now,
    exp: now + ttlSeconds,
    sd: claims
  });
  const signature = createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date((now + ttlSeconds) * 1000) };
}

/**
 * Read a token back and check it: signature, issuer, audience, expiry, and that it is a person's.
 * The lottery PC's own control-plane routes (roster, unbind) are authorised with it.
 */
export function readSupabaseToken(token: string): { claims: SupabaseClaims; expiresAt: Date; role: string } {
  const [header, payload, signature, extra] = token.split(".");
  const invalid = new ControlPlaneError(401, "TOKEN_INVALID", "That token is not valid");
  if (!header || !payload || !signature || extra !== undefined) throw invalid;

  const expected = createHmac("sha256", secret()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw invalid;

  let body: { iss?: string; aud?: string; role: string; exp: number; sd?: SupabaseClaims };
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw invalid;
  }
  if (body.iss !== ISSUER || body.aud !== "authenticated" || body.sd?.kind !== "user") throw invalid;
  if (body.exp * 1000 <= Date.now()) throw new ControlPlaneError(401, "TOKEN_EXPIRED", "That token has expired");
  return { claims: body.sd, expiresAt: new Date(body.exp * 1000), role: body.role };
}
