import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import {
  AdminSessionModel,
  InternalAdminModel,
  OrganizationModel,
  TenantStoreModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import {
  ControlPlaneError,
  clearRateLimit,
  constantTimeEqual,
  hashSecret,
  publicId,
  randomSecret,
  rateLimitBlocked,
  recordRateHit,
  sha256,
  verifySecret
} from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/audit";

export const ADMIN_COOKIE = "sd_session";

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
  return adminToken(req);
}

async function adminToken(req: Request): Promise<string> {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  try {
    return (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  } catch {
    return cookieFromHeader(req.headers.get("cookie"), ADMIN_COOKIE);
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
  const token = await adminToken(req);
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
    throw new ControlPlaneError(
      403,
      "STORE_SUSPENDED",
      "This organization or store is suspended. Ask your organization's administrator to reactivate it."
    );
  }
  return { organizationId, storeId, workerInstallationId, credentialId };
}

// ── Staff sign-in (P7) ───────────────────────────────────────────────────────

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_FAILURES_PER_IP = 10;
const LOGIN_FAILURES_PER_EMAIL = 5;

let dummyHash: Promise<string> | null = null;
/** Verify against something for an unknown e-mail too, so the answer takes as long. */
function unknownAccountHash(): Promise<string> {
  dummyHash ??= hashSecret(randomSecret(16));
  return dummyHash;
}

/**
 * Staff sign-in with lockout: 10 failures from one address or 5 for one
 * e-mail within 15 minutes refuse further attempts (429) until the window
 * ends. A success clears the e-mail's count. Every success and failure is
 * audited, never with the password.
 */
export async function authenticateInternalAdminLogin(email: string, password: string, ip = "unknown") {
  await connectDb();
  const normalizedEmail = email.trim().toLowerCase();
  const ipKey = `admin-login-ip:${ip}`;
  const emailKey = `admin-login-email:${normalizedEmail}`;
  const ipHash = sha256(ip).slice(0, 16);
  if (rateLimitBlocked(ipKey, LOGIN_FAILURES_PER_IP) || rateLimitBlocked(emailKey, LOGIN_FAILURES_PER_EMAIL)) {
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
    recordRateHit(ipKey, LOGIN_WINDOW_MS);
    recordRateHit(emailKey, LOGIN_WINDOW_MS);
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
  clearRateLimit(emailKey);
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
