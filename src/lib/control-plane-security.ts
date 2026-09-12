import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import argon2 from "argon2";

export const CONTRACT_VERSION = "setup-v1";
export const CONTROL_PLANE_ISSUER = process.env.CONTROL_PLANE_ISSUER || "storedesk-web";
/** 12 h: long enough for a full retail shift without a round trip to the cloud. */
export const CLIENT_SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Mint the per-installation key that signs and verifies client sessions. */
export function issueRelayKey(): string {
  return randomSecret(32);
}
const SECRET_FIELD = /(secret|password|credential|setupkey|agentkey|authorization|token)$/i;

export class ControlPlaneError extends Error {
  /**
   * `details` are spread next to `error` in the response body, e.g. the
   * current role on a 409 so the caller can show it without a second request.
   */
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function publicId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Deterministic JSON: object keys sorted at every level, array order kept,
 * `undefined` dropped, Dates as ISO strings. Used for content hashes that
 * must not change when the same data is assembled in a different key order.
 */
export function canonicalJson(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (input instanceof Date) return input.toISOString();
    if (Array.isArray(input)) return input.map(sortKeys);
    if (!input || typeof input !== "object") return input;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      const child = (input as Record<string, unknown>)[key];
      if (child !== undefined) sorted[key] = sortKeys(child);
    }
    return sorted;
  };
  return JSON.stringify(sortKeys(value));
}

export async function hashSecret(value: string): Promise<string> {
  return argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifySecret(hash: string, value: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function issueWorkerCredential(): { credentialId: string; secret: string; plaintext: string } {
  const credentialId = publicId("wcred");
  const secret = randomSecret(32);
  return { credentialId, secret, plaintext: `${credentialId}.${secret}` };
}

export function issueSetupKey(): { keyId: string; secret: string; plaintext: string } {
  const keyId = publicId("set");
  const secret = randomSecret(24);
  return { keyId, secret, plaintext: `${keyId}.${secret}` };
}

export function parseSetupKey(value: string): { keyId: string; secret: string } {
  const match = /^(set_[a-f0-9]{32})\.([A-Za-z0-9_-]{30,})$/.exec(value);
  if (!match) {
    throw new ControlPlaneError(401, "SETUP_KEY_INVALID", "Setup key is invalid");
  }
  return { keyId: match[1], secret: match[2] };
}

export function safeJson<T>(value: T): T {
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map((item) => safeJson(item)) as T;
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      key === "__v" ||
      key === "passwordHash" ||
      key === "secretHash" ||
      key === "relayKey" ||
      key === "cloudflareToken" ||
      SECRET_FIELD.test(key)
    ) {
      continue;
    }
    result[key] = safeJson(child);
  }
  return result as T;
}

export function assertSameTenant(
  expectedOrganizationId: string,
  ...records: Array<{ organizationId?: unknown } | null | undefined>
): void {
  if (
    records.some(
      (record) => !record || String(record.organizationId ?? "") !== expectedOrganizationId
    )
  ) {
    throw new ControlPlaneError(404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
}

type RateEntry = { count: number; resetAt: number };
const rateGlobal = globalThis as unknown as { __sdRateLimits?: Map<string, RateEntry> };
const rateLimits = rateGlobal.__sdRateLimits ?? new Map<string, RateEntry>();
rateGlobal.__sdRateLimits = rateLimits;

export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number; code?: string },
  now = Date.now()
): void {
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  current.count += 1;
  if (current.count > options.limit) {
    throw new ControlPlaneError(
      429,
      options.code ?? "ACTIVATION_RATE_LIMITED",
      "Too many attempts",
      true
    );
  }
}

export function resetRateLimitsForTests(): void {
  rateLimits.clear();
}

/**
 * Failure counters (admin sign-in): check before the work, record only when it
 * fails. Unlike enforceRateLimit, a success never spends the budget.
 * In-memory per instance, like enforceRateLimit.
 */
export function rateLimitBlocked(key: string, limit: number, now = Date.now()): boolean {
  const entry = rateLimits.get(key);
  return Boolean(entry && entry.resetAt > now && entry.count >= limit);
}

export function recordRateHit(key: string, windowMs: number, now = Date.now()): void {
  const entry = rateLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
}

export function clearRateLimit(key: string): void {
  rateLimits.delete(key);
}

/** The caller's address as Vercel reports it; "unknown" outside a proxy. */
export function callerIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Mint a client session token for one assignment.
 *
 * Signed with the installation's own `relayKey` so the Worker can verify it
 * offline, with no shared global secret and no call back to the control plane.
 * A compromise is contained to a single store.
 */
export function signClientSession(
  relayKey: string,
  claims: {
    sub: string;
    storeId: string;
    organizationId: string;
    workerInstallationId: string;
    assignmentId: string;
    audience: "desktop" | "mobile";
    role: string;
    scopes: string[];
  },
  ttlSeconds = CLIENT_SESSION_TTL_SECONDS
): { token: string; expiresAt: Date } {
  if (!relayKey || relayKey.length < 32) {
    throw new ControlPlaneError(
      503,
      "RELAY_UNAVAILABLE",
      "Worker has no relay key; re-activate the installation",
      true
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + ttlSeconds) * 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: CONTROL_PLANE_ISSUER,
    aud: "storedesk-worker",
    sub: claims.sub,
    organizationId: claims.organizationId,
    storeId: claims.storeId,
    workerInstallationId: claims.workerInstallationId,
    assignmentId: claims.assignmentId,
    audience: claims.audience,
    role: claims.role,
    scopes: claims.scopes,
    iat: now,
    exp: now + ttlSeconds,
    jti: publicId("cses")
  });
  const signature = createHmac("sha256", relayKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt };
}

export class AtomicSingleUseGrant {
  private state: "issued" | "consumed" | "expired" = "issued";

  constructor(private readonly expiresAt: number) {}

  async redeem<T>(mint: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.state === "consumed") {
      throw new ControlPlaneError(409, "SETUP_KEY_CONSUMED", "Setup key has been consumed");
    }
    if (this.state === "expired" || this.expiresAt <= now) {
      this.state = "expired";
      throw new ControlPlaneError(410, "SETUP_KEY_EXPIRED", "Setup key has expired");
    }
    this.state = "consumed";
    try {
      return await mint();
    } catch (error) {
      this.state = "issued";
      throw error;
    }
  }
}
