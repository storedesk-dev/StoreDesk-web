import {
  AuditEventModel,
  InternalAdminModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { createAdminSession, type InternalAdminActor } from "@/lib/admin-auth";
import { hashSecret, issueRelayKey, issueWorkerCredential, publicId } from "@/lib/control-plane-security";
import { createOrganization } from "@/lib/organizations";
import { createStore } from "@/lib/tenant-stores";

export const ADMIN_PASSWORD = "correct horse battery staple";

export type TestAdmin = InternalAdminActor & { token: string };

export async function createAdmin(email = "admin@example.invalid", password = ADMIN_PASSWORD): Promise<TestAdmin> {
  const adminId = publicId("adm");
  await InternalAdminModel.create({
    adminId,
    email,
    name: "Test Admin",
    passwordHash: await hashSecret(password),
    status: "active"
  });
  const session = await createAdminSession(adminId);
  return { adminId, email, token: session.token };
}

type RequestOptions = { token?: string; body?: unknown; headers?: Record<string, string> };

export function request(method: string, path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body:
      options.body === undefined ? undefined : typeof options.body === "string" ? options.body : JSON.stringify(options.body)
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: any) => Promise<Response>;

export type Called = { status: number; body: any; headers: Headers }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Run a route handler with its params; the body is parsed JSON (or null). */
export async function call(handler: Handler, req: Request, params: Record<string, string> = {}): Promise<Called> {
  const res = await handler(req, { params: Promise.resolve(params) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

export async function auditActions(filter: Record<string, unknown> = {}): Promise<string[]> {
  const rows = await AuditEventModel.find(filter).sort({ _id: 1 }).lean();
  return rows.map((row) => String(row.action));
}

export async function lastAudit(action: string) {
  return AuditEventModel.findOne({ action }).sort({ _id: -1 }).lean();
}

/** An organization with a standard subscription (5 stores, 1 PC per store) and one store. */
export async function seedOrganization(
  admin: InternalAdminActor,
  options: { slug?: string; name?: string; maxStores?: number; maxWorkerInstallations?: number; storeName?: string } = {}
) {
  const { organization, subscription } = await createOrganization(admin, {
    name: options.name ?? "Example Retail",
    slug: options.slug ?? "example-retail",
    subscription: {
      plan: "standard",
      maxStores: options.maxStores ?? 5,
      maxWorkerInstallations: options.maxWorkerInstallations ?? 1
    }
  });
  const { store } = await createStore(admin, organization.organizationId, {
    name: options.storeName ?? "Store 42",
    storeNumber: "42",
    contactEmail: "store42@example.invalid"
  });
  return { organization, subscription: subscription!, store };
}

/** An activated store PC with a worker credential, as if its setup key had been redeemed. */
export async function activatePc(organizationId: string, storeId: string, subscriptionId: string) {
  const workerInstallationId = publicId("winst");
  const credential = issueWorkerCredential();
  await WorkerInstallationModel.create({
    organizationId,
    storeId,
    subscriptionId,
    workerInstallationId,
    workerName: "Back office PC",
    contactEmail: "store42@example.invalid",
    status: "active",
    workerCredentialId: credential.credentialId,
    activatedAt: new Date()
  });
  await WorkerCredentialModel.create({
    credentialId: credential.credentialId,
    secretHash: await hashSecret(credential.secret),
    relayKey: issueRelayKey(),
    keyId: "set_test",
    organizationId,
    storeId,
    workerInstallationId,
    status: "active",
    issuedAt: new Date()
  });
  return { workerInstallationId, token: credential.plaintext, credentialId: credential.credentialId };
}

export const VALID_ACKS = {
  eulaVersion: "2026-07",
  eulaDocumentSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  privacyVersion: "2026-07",
  systemAcknowledgementVersion: "setup-v1",
  contactEmail: "store42@example.invalid",
  acceptedAt: "2026-09-12T10:00:00.000Z",
  osAcknowledged: true,
  privacyAcknowledged: true,
  localDataAcknowledged: true
};

export const VALID_INSTALLATION = { platform: "windows", workerVersion: "1.0.0", electronVersion: "1.0.0" };
