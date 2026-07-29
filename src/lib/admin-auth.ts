import { cookies } from "next/headers";
import { connectDb } from "@/lib/db";
import {
  AdminSessionModel,
  InternalAdminModel,
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

export const ADMIN_COOKIE = "sd_session";

export type InternalAdminActor = {
  adminId: string;
  email: string;
};

function bearerOrCookie(req: Request, cookieValue?: string): string {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return cookieValue ?? "";
}

export async function createAdminSession(
  adminId: string
): Promise<{ token: string; expiresAt: Date }> {
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
  const cookieStore = await cookies();
  const token = bearerOrCookie(req, cookieStore.get(ADMIN_COOKIE)?.value);
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
  return {
    organizationId: String(credential.organizationId),
    storeId: String(credential.storeId),
    workerInstallationId: String(credential.workerInstallationId),
    credentialId
  };
}

export async function authenticateInternalAdminLogin(email: string, password: string) {
  await connectDb();
  const normalizedEmail = email.trim().toLowerCase();
  let admin = await InternalAdminModel.findOne({ email: normalizedEmail }).select("+passwordHash");

  const bootstrapEmail = process.env.SUPPORT_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.SUPPORT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (
    !admin &&
    bootstrapEmail === normalizedEmail &&
    bootstrapPassword &&
    password === bootstrapPassword
  ) {
    admin = await InternalAdminModel.create({
      adminId: publicId("adm"),
      email: normalizedEmail,
      name: "StoreDesk Support",
      passwordHash: await hashSecret(password),
      status: "active"
    });
  }
  if (!admin || !(await verifySecret(String(admin.passwordHash), password))) {
    throw new ControlPlaneError(401, "LOGIN_INVALID", "Email or password is invalid");
  }
  if (admin.status !== "active") {
    throw new ControlPlaneError(403, "AUTHORIZATION_DENIED", "Internal admin is disabled");
  }
  admin.lastLoginAt = new Date();
  await admin.save();
  return admin;
}

/** @deprecated Use authenticateInternalAdminLogin */
export const authenticateLogin = authenticateInternalAdminLogin;

export async function revokeSession(token: string | undefined): Promise<void> {
  const sessionId = token?.split(".")[0];
  if (sessionId) await AdminSessionModel.updateOne({ sessionId }, { revokedAt: new Date() });
}

export async function createSession(adminId: string) {
  return createAdminSession(adminId);
}

/** Middleware performs only a presence check; route handlers validate the stored session. */
export async function isValidAdminCookie(cookieValue: string | undefined): Promise<boolean> {
  return Boolean(cookieValue?.startsWith("ses_") && cookieValue.includes("."));
}
