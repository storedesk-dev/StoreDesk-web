import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import argon2 from "argon2";

export const CONTRACT_VERSION = "setup-v1";
const SECRET_FIELD = /(secret|password|credential|setupkey|agentkey|authorization|token)$/i;

export class ControlPlaneError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false
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
    if (key === "cloudflareToken") {
      // Explicitly allow tunnel tokens so the admin UI can display them
    } else if (key === "__v" || key === "passwordHash" || key === "secretHash" || SECRET_FIELD.test(key)) {
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
  options: { limit: number; windowMs: number },
  now = Date.now()
): void {
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }
  current.count += 1;
  if (current.count > options.limit) {
    throw new ControlPlaneError(429, "ACTIVATION_RATE_LIMITED", "Too many attempts", true);
  }
}

export function resetRateLimitsForTests(): void {
  rateLimits.clear();
}

export function signRelaySession(claims: {
  sub: string;
  storeId: string;
  installationId: string;
  workerInstallationId?: string;
  organizationId?: string;
  assignmentId?: string;
  audience?: "desktop" | "mobile" | "worker";
  role: "agent" | "client" | "app_user";
  scopes: string[];
}): { token: string; expiresAt: Date } {
  const secret = process.env.RELAY_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new ControlPlaneError(503, "RELAY_UNAVAILABLE", "Relay session signing is unavailable", true);
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + 300) * 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT", kid: process.env.RELAY_KEY_ID || "relay-v1" });
  const workerInstallationId = claims.workerInstallationId || claims.installationId;
  const payload = encode({
    iss: process.env.CONTROL_PLANE_ISSUER || "storedesk-web",
    aud: "storedesk-cloud-hub",
    sub: claims.sub,
    storeId: claims.storeId,
    installationId: claims.installationId,
    workerInstallationId,
    organizationId: claims.organizationId,
    assignmentId: claims.assignmentId,
    audience: claims.audience,
    role: claims.role === "client" ? "app_user" : claims.role,
    scopes: claims.scopes,
    iat: now,
    exp: now + 300,
    jti: publicId("rly")
  });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
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
