import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import {
  AdminSessionModel,
  InternalAdminModel,
  LoginThrottleModel,
  OrganizationModel,
  TenantStoreModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import {
  ControlPlaneError,
  constantTimeEqual,
  hashSecret,
  publicId,
  randomSecret,
  sha256,
  verifySecret
} from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/audit";

/**
 * The staff session cookie. In production it is `__Host-sd_session`: the
 * browser only accepts it with Secure, Path=/ and no Domain, so a sibling
 * host (a store's *.tunnels.storedesk.net) can neither set nor read it.
 * `__Host-` requires HTTPS, so local runs on http://localhost use the plain name.
 */
export function adminCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-sd_session" : "sd_session";
}

export function adminCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    // Strict: the cookie never rides a request started on another site,
    // including a same-site store tunnel host.
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : { maxAge: 0 })
  };
}

export type InternalAdminActor = {
  adminId: string;
  email: string;
};

function cookieFromHeader(header: string | null, name: string): string {
  for (const part of header?.split(";") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

/** Bearer header first, then the session cookie. Works outside a request scope (tests, scripts). */
export async function readAdminToken(req: Request): Promise<string> {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  try {
    return (await cookies()).get(adminCookieName())?.value ?? "";
  } catch {
    return cookieFromHeader(req.headers.get("cookie"), adminCookieName());
  }
}

export async function createAdminSession(
  adminId: string
): Promise<{ token: string; expiresAt: Date }> {
  await connectDb();
  const sessionId = publicId("ses");
  const secret = randomSecret(32);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await AdminSessionModel.create({
    sessionId,
    adminId,
    secretHash: sha256(secret),
    expiresAt,
    lastSeenAt: new Date()
  });
  return { token: `${sessionId}.${secret}`, expiresAt };
}

export async function requireInternalAdmin(req: Request): Promise<InternalAdminActor> {
  await connectDb();
  const token = await readAdminToken(req);
  const [sessionId, secret, extra] = token.split(".");
  if (!sessionId || !secret || extra) {
    throw new ControlPlaneError(401, "AUTHENTICATION_REQUIRED", "Authentication required");
  }
  const session = await AdminSessionModel.findOne({
    sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  })
    .select("+secretHash")
    .lean();
  if (!session || !constantTimeEqual(String(session.secretHash), sha256(secret))) {
    throw new ControlPlaneError(401, "SESSION_INVALID", "Session is invalid or expired");
  }
  const admin = await InternalAdminModel.findOne({
    adminId: session.adminId,
    status: "active"
  }).lean();
  if (!admin) {
    throw new ControlPlaneError(403, "AUTHORIZATION_DENIED", "Internal admin is not active");
  }
  await AdminSessionModel.updateOne({ sessionId }, { lastSeenAt: new Date() });
  return { adminId: String(admin.adminId), email: String(admin.email) };
}

/** @deprecated Use requireInternalAdmin — kept as alias for gradual call-site updates. */
export const requireActor = requireInternalAdmin;

const LAST_SEEN_EVERY_MS = 60_000;

/**
 * The store server, by its worker credential. Also refuses a suspended
 * organization or store with 403 STORE_SUSPENDED (P12): the store's access
 * pull then turns its sign-in off, like a revocation, until it is reactivated.
 */
export async function authenticateWorker(req: Request): Promise<{
  organizationId: string;
  storeId: string;
  workerInstallationId: string;
  credentialId: string;
}> {
  await connectDb();
  const authorization = req.headers.get("authorization");
  const value = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const [credentialId, secret, extra] = value.split(".");
  if (!credentialId?.startsWith("wcred_") || !secret || extra) {
    throw new ControlPlaneError(401, "WORKER_CREDENTIAL_INVALID", "Worker authentication failed");
  }
  const credential = await WorkerCredentialModel.findOne({ credentialId, status: "active" })
    .select("+secretHash")
    .lean();
  if (!credential || !(await verifySecret(String(credential.secretHash), secret))) {
    throw new ControlPlaneError(401, "WORKER_CREDENTIAL_INVALID", "Worker authentication failed");
  }
  const installation = await WorkerInstallationModel.findOne({
    workerInstallationId: credential.workerInstallationId,
    organizationId: credential.organizationId,
    storeId: credential.storeId,
    status: { $in: ["active", "degraded"] }
  }).lean();
  if (!installation) {
    throw new ControlPlaneError(401, "WORKER_CREDENTIAL_INVALID", "Worker authentication failed");
  }
  const organizationId = String(credential.organizationId);
  const storeId = String(credential.storeId);
  const workerInstallationId = String(credential.workerInstallationId);

  const lastSeen = installation.lastSeenAt ? new Date(installation.lastSeenAt).getTime() : 0;
  if (Date.now() - lastSeen > LAST_SEEN_EVERY_MS) {
    await WorkerInstallationModel.updateOne({ workerInstallationId }, { $set: { lastSeenAt: new Date() } });
  }

  const [org, store] = await Promise.all([
    OrganizationModel.findOne({ organizationId }).select("status").lean(),
    TenantStoreModel.findOne({ organizationId, storeId }).select("status").lean()
  ]);
  if (!org || !store) {
    throw new ControlPlaneError(401, "WORKER_CREDENTIAL_INVALID", "Worker authentication failed");
  }
  if (org.status === "suspended" || store.status === "suspended" || store.status === "closed") {
    // Store-facing: every edge route answers with this.
    throw new ControlPlaneError(403, "STORE_SUSPENDED", "This store is suspended in StoreDesk.");
  }
  return { organizationId, storeId, workerInstallationId, credentialId };
}

// ── Staff sign-in (P7) ───────────────────────────────────────────────────────

const LOGIN_WINDOW_MS = 15 * 60_000;
export const LOGIN_ATTEMPTS_PER_IP = 10;
export const LOGIN_ATTEMPTS_PER_EMAIL = 5;

/**
 * Count one attempt against `key` and answer the count in the current window.
 * One atomic update in MongoDB, shared by every server instance: a window
 * that has ended starts again at 1. A TTL index removes ended windows.
 */
async function countAttempt(key: string, now: Date): Promise<number> {
  const expires = new Date(now.getTime() + LOGIN_WINDOW_MS);
  const live = { $gt: ["$expiresAt", now] };
  for (let attempt = 0; ; attempt += 1) {
    try {
      const doc = await LoginThrottleModel.collection.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              count: { $cond: [live, { $add: ["$count", 1] }, 1] },
              expiresAt: { $cond: [live, "$expiresAt", expires] }
            }
          }
        ],
        { upsert: true, returnDocument: "after" }
      );
      return Number(doc?.count ?? 1);
    } catch (error) {
      // Two first attempts raced to insert the same key; the retry increments.
      if ((error as { code?: number }).code === 11000 && attempt === 0) continue;
      throw error;
    }
  }
}

let dummyHash: Promise<string> | null = null;
/** Verify against something for an unknown e-mail too, so the answer takes as long. */
function unknownAccountHash(): Promise<string> {
  dummyHash ??= hashSecret(randomSecret(16));
  return dummyHash;
}

/**
 * Staff sign-in with lockout: at most 10 attempts from one address and 5 for
 * one e-mail in 15 minutes. Each attempt is counted atomically in MongoDB
 * before the password is checked, so parallel attempts cannot slip past the
 * limit and every instance sees the same counts. A success clears both
 * counts. Every success and failure is audited, never with the password.
 */
export async function authenticateInternalAdminLogin(email: string, password: string, ip = "unknown") {
  await connectDb();
  const normalizedEmail = email.trim().toLowerCase();
  const ipHash = sha256(ip).slice(0, 16);
  const ipKey = `admin-login:ip:${sha256(ip)}`;
  const emailKey = `admin-login:email:${sha256(normalizedEmail)}`;
  const now = new Date();
  const [ipCount, emailCount] = await Promise.all([countAttempt(ipKey, now), countAttempt(emailKey, now)]);
  if (ipCount > LOGIN_ATTEMPTS_PER_IP || emailCount > LOGIN_ATTEMPTS_PER_EMAIL) {
    throw new ControlPlaneError(
      429,
      "LOGIN_RATE_LIMITED",
      "Too many sign-in attempts. Wait 15 minutes and try again.",
      true
    );
  }

  let admin = await InternalAdminModel.findOne({ email: normalizedEmail }).select("+passwordHash");

  const bootstrapEmail = process.env.SUPPORT_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.SUPPORT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (
    !admin &&
    bootstrapEmail === normalizedEmail &&
    bootstrapPassword &&
    constantTimeEqual(password, bootstrapPassword)
  ) {
    admin = await InternalAdminModel.create({
      adminId: publicId("adm"),
      email: normalizedEmail,
      name: "StoreDesk Support",
      passwordHash: await hashSecret(password),
      status: "active"
    });
  }
  const valid = admin
    ? await verifySecret(String(admin.passwordHash), password)
    : (await verifySecret(await unknownAccountHash(), password), false);
  if (!admin || !valid) {
    await writeAudit({
      actorType: "system",
      actorId: "admin_login",
      action: "admin.login_failed",
      targetType: "internal_admin",
      targetId: admin ? String(admin.adminId) : normalizedEmail,
      metadata: { email: normalizedEmail, ipHash }
    });
    throw new ControlPlaneError(401, "LOGIN_INVALID", "Email or password is invalid");
  }
  if (admin.status !== "active") {
    throw new ControlPlaneError(403, "AUTHORIZATION_DENIED", "Internal admin is disabled");
  }
  await LoginThrottleModel.deleteMany({ key: { $in: [ipKey, emailKey] } });
  admin.lastLoginAt = new Date();
  await admin.save();
  await writeAudit({
    actorType: "internal_admin",
    actorId: String(admin.adminId),
    action: "admin.login",
    targetType: "internal_admin",
    targetId: String(admin.adminId),
    metadata: { ipHash }
  });
  return admin;
}

/** @deprecated Use authenticateInternalAdminLogin */
export const authenticateLogin = authenticateInternalAdminLogin;

export async function revokeSession(token: string | undefined): Promise<void> {
  const sessionId = token?.split(".")[0];
  if (!sessionId) return;
  await connectDb();
  await AdminSessionModel.updateOne({ sessionId }, { revokedAt: new Date() });
}

export async function createSession(adminId: string) {
  return createAdminSession(adminId);
}

/** Middleware performs only a presence check; route handlers validate the stored session. */
export async function isValidAdminCookie(cookieValue: string | undefined): Promise<boolean> {
  return Boolean(cookieValue?.startsWith("ses_") && cookieValue.includes("."));
}
