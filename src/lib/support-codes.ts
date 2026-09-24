import { randomInt } from "node:crypto";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { InternalAdminModel, SupportCodeModel } from "@/models/ControlPlane";
import { ControlPlaneError, enforceRateLimit, publicId, sha256 } from "@/lib/control-plane-security";
import { auditAdmin, writeAudit } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { requireStore } from "@/lib/tenant-stores";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Support codes: StoreDesk staff issue one on a store's PC & phones page and
 * read it to the store; the store PC, stuck at sign-in, redeems it to unlock
 * riskier troubleshooting (viewing logs, resetting activation).
 *
 * - `sup_` + 10 characters of Crockford base32 (no I, L, O or U), shown as
 *   `sup_XXXXX-XXXXX` for reading aloud. Case, spaces, hyphens and the prefix
 *   don't matter when typed; O reads as 0 and I / L as 1.
 * - Valid 30 minutes, single use, bound to its store. Shown once; only its
 *   SHA-256 is stored.
 * - Redeem (worker credential): 404 SUPPORT_CODE_INVALID for an unknown code
 *   or another store's (no enumeration), 410 SUPPORT_CODE_EXPIRED (expired or
 *   revoked), 409 SUPPORT_CODE_USED. Rate-limited per installation; every
 *   attempt audited with its result, never the code.
 */

type Doc = Record<string, unknown>;

export const SUPPORT_CODE_TTL_MS = 30 * 60_000;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BODY = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const LIST_LIMIT = 20;
const REDEEM_LIMIT = { limit: 10, windowMs: 15 * 60_000, code: "SUPPORT_CODE_RATE_LIMITED" };

export type SupportCodeStatus = "active" | "used" | "revoked" | "expired";

export const RedeemSupportCodeSchema = z.object({ code: z.string().trim().min(1).max(64) }).strict();

export function newSupportCode(): { body: string; display: string } {
  let body = "";
  for (let i = 0; i < 10; i += 1) body += ALPHABET[randomInt(ALPHABET.length)];
  return { body, display: `sup_${body.slice(0, 5)}-${body.slice(5)}` };
}

/** The code's 10 characters as typed, or null when it can't be one. */
export function normalizeSupportCode(raw: string): string | null {
  let value = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (value.startsWith("SUP_")) value = value.slice(4);
  else if (value.length === 13 && value.startsWith("SUP")) value = value.slice(3);
  value = value.replace(/O/g, "0").replace(/[IL]/g, "1");
  return BODY.test(value) ? value : null;
}

const hashOf = (body: string) => sha256(`support:${body}`);

const iso = (value: unknown): string | null => {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

function statusOf(doc: Doc, now = Date.now()): SupportCodeStatus {
  if (doc.status === "used") return "used";
  if (doc.status === "revoked") return "revoked";
  return new Date(String(doc.expiresAt)).getTime() <= now ? "expired" : "active";
}

export function supportCodeView(doc: Doc) {
  return {
    supportCodeId: String(doc.supportCodeId),
    status: statusOf(doc),
    issuedAt: iso(doc.createdAt),
    expiresAt: iso(doc.expiresAt),
    issuedBy: String(doc.issuedBy),
    usedAt: iso(doc.usedAt),
    revokedAt: iso(doc.revokedAt)
  };
}

/** Issue a code for the store; the plain code is in the answer only. */
export async function issueSupportCode(admin: InternalAdminActor, storeId: string) {
  const organizationId = String((await requireStore(storeId)).organizationId);
  const who = (await InternalAdminModel.findOne({ adminId: admin.adminId }).select("name email").lean()) as Doc | null;
  const issuedBy = String(who?.name || who?.email || admin.email);
  const expiresAt = new Date(Date.now() + SUPPORT_CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newSupportCode();
    try {
      const created = await SupportCodeModel.create({
        organizationId,
        storeId,
        supportCodeId: publicId("supc"),
        codeHash: hashOf(code.body),
        status: "active",
        expiresAt,
        issuedByAdminId: admin.adminId,
        issuedBy
      });
      const doc = created.toObject() as Doc;
      await auditAdmin(admin, {
        organizationId,
        storeId,
        action: "support_code.issue",
        targetType: "support_code",
        targetId: String(doc.supportCodeId),
        metadata: { expiresAt: expiresAt.toISOString() }
      });
      return { code: code.display, supportCode: supportCodeView(doc) };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) continue;
      throw error;
    }
  }
  throw new ControlPlaneError(503, "SUPPORT_CODE_BUSY", "Could not issue a support code; try again", true);
}

/** The store's latest codes (never the codes themselves). */
export async function listSupportCodes(storeId: string) {
  await requireStore(storeId);
  const rows = (await SupportCodeModel.find({ storeId }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean()) as Doc[];
  return rows.map(supportCodeView);
}

/** Revoke an active code. 409 SUPPORT_CODE_NOT_ACTIVE when it is used, expired or revoked. */
export async function revokeSupportCode(admin: InternalAdminActor, storeId: string, supportCodeId: string) {
  await connectDb();
  const current = (await SupportCodeModel.findOne({ storeId, supportCodeId }).lean()) as Doc | null;
  if (!current) throw notFound("Support code");
  const notActive = (status: SupportCodeStatus) =>
    new ControlPlaneError(409, "SUPPORT_CODE_NOT_ACTIVE", `This support code is already ${status}.`);
  if (statusOf(current) !== "active") throw notActive(statusOf(current));
  const updated = (await SupportCodeModel.findOneAndUpdate(
    { supportCodeId, status: "active", expiresAt: { $gt: new Date() } },
    { $set: { status: "revoked", revokedAt: new Date(), revokedByAdminId: admin.adminId } },
    { returnDocument: "after" }
  ).lean()) as Doc | null;
  if (!updated) {
    const latest = (await SupportCodeModel.findOne({ supportCodeId }).lean()) as Doc | null;
    throw notActive(latest ? statusOf(latest) : "revoked");
  }
  await auditAdmin(admin, {
    organizationId: String(current.organizationId),
    storeId,
    action: "support_code.revoke",
    targetType: "support_code",
    targetId: supportCodeId
  });
  return supportCodeView(updated);
}

type Worker = { organizationId: string; storeId: string; workerInstallationId: string };

/** The store PC redeems a code for its own store. */
export async function redeemSupportCode(worker: Worker, raw: string) {
  enforceRateLimit(`support-code:${worker.workerInstallationId}`, REDEEM_LIMIT);
  await connectDb();
  const audit = (result: string, supportCodeId?: string) =>
    writeAudit({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId,
      actorType: "worker",
      actorId: worker.workerInstallationId,
      action: "support_code.redeem",
      targetType: "support_code",
      targetId: supportCodeId ?? "unknown",
      metadata: { result }
    });

  const body = normalizeSupportCode(raw);
  const doc = body ? ((await SupportCodeModel.findOne({ codeHash: hashOf(body) }).lean()) as Doc | null) : null;
  // Unknown, malformed or another store's: all the same answer.
  if (!doc || doc.organizationId !== worker.organizationId || doc.storeId !== worker.storeId) {
    await audit("invalid");
    throw new ControlPlaneError(404, "SUPPORT_CODE_INVALID", "That support code isn't valid for this store.");
  }
  const supportCodeId = String(doc.supportCodeId);
  const now = new Date();
  const used = (await SupportCodeModel.findOneAndUpdate(
    { supportCodeId, status: "active", expiresAt: { $gt: now } },
    { $set: { status: "used", usedAt: now, usedByInstallationId: worker.workerInstallationId } },
    { returnDocument: "after" }
  ).lean()) as Doc | null;
  if (!used) {
    const latest = ((await SupportCodeModel.findOne({ supportCodeId }).lean()) as Doc | null) ?? doc;
    const status = statusOf(latest);
    await audit(status, supportCodeId);
    if (status === "used") {
      throw new ControlPlaneError(409, "SUPPORT_CODE_USED", "This support code has already been used. Ask StoreDesk support for a new one.");
    }
    throw new ControlPlaneError(410, "SUPPORT_CODE_EXPIRED", "This support code has expired. Ask StoreDesk support for a new one.");
  }
  await audit("ok", supportCodeId);
  return { ok: true as const, expiresAt: iso(used.expiresAt), issuedBy: String(used.issuedBy) };
}
