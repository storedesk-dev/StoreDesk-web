import { randomBytes, randomUUID } from "node:crypto";
import { connectDb } from "@/lib/db";
import { LotteryRefreshCredentialModel } from "@/models/ControlPlane";
import { ControlPlaneError, constantTimeEqual, sha256 } from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/audit";

/**
 * A person's refresh credential on a lottery PC (D-26, design lottery-sign-in.md §3.3).
 *
 * `lrt_<familyId>.<secret>`: the family id is a uuid, the secret 32 random bytes. Only SHA-256 is
 * stored. **Every use rotates**: the answer carries the next generation and the one presented stops
 * working. Presenting a generation that has already been rotated away means the credential was
 * copied, so the whole family is revoked.
 *
 * Kept apart from the sign-in flows (lib/lottery-pc.ts) so the places that must revoke — a person
 * disabled, a password changed, an assignment removed — can import this without a cycle.
 */

type Doc = Record<string, unknown>;

export const IDLE_DAYS = 60;
export const ABSOLUTE_DAYS = 180;
const PURGE_AFTER_DAYS = 30;
/** How many rotated-away generations are remembered, to tell reuse from a bad guess. */
const REMEMBERED = 20;
const DAY_MS = 86_400_000;

const FORMAT = /^lrt_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export type RevokeReason =
  | "account_disabled"
  | "password_changed"
  | "assignment_removed"
  | "no_lottery_access"
  | "pc_replaced"
  | "pc_unbound"
  | "signed_out"
  | "superseded"
  | "reuse"
  | "expired"
  | "d26_lottery_sign_in";

export function parseRefreshCredential(raw: string): { familyId: string; secret: string } | null {
  const match = FORMAT.exec(raw.trim());
  return match ? { familyId: match[1]!, secret: match[2]! } : null;
}

const newSecret = () => randomBytes(32).toString("base64url");

/**
 * Start a family for a person on a PC at a store. An earlier live family of the same person on the
 * same PC is superseded: the PC keeps one credential per person, so the old one would only linger.
 */
export async function issueRefreshFamily(input: { appUserId: string; storeId: string; pcId: string }): Promise<string> {
  await connectDb();
  const now = new Date();
  await LotteryRefreshCredentialModel.updateMany(
    { appUserId: input.appUserId, pcId: input.pcId, status: "active" },
    { $set: { status: "revoked", revokedAt: now, revokedReason: "superseded" } }
  );
  const familyId = randomUUID();
  const secret = newSecret();
  const absolute = new Date(now.getTime() + ABSOLUTE_DAYS * DAY_MS);
  await LotteryRefreshCredentialModel.create({
    familyId,
    generation: 1,
    hash: sha256(secret),
    previousHashes: [],
    appUserId: input.appUserId,
    storeId: input.storeId,
    pcId: input.pcId,
    app: "lottery",
    status: "active",
    lastUsedAt: now,
    idleExpiresAt: new Date(now.getTime() + IDLE_DAYS * DAY_MS),
    absoluteExpiresAt: absolute,
    purgeAt: new Date(absolute.getTime() + PURGE_AFTER_DAYS * DAY_MS)
  });
  return `lrt_${familyId}.${secret}`;
}

/** Revoke every live family matching the filter. Answers how many. */
export async function revokeRefreshFamilies(
  filter: { appUserId?: string; storeId?: string; pcId?: string; familyId?: string },
  reason: RevokeReason
): Promise<number> {
  await connectDb();
  const query: Doc = { status: "active" };
  for (const [key, value] of Object.entries(filter)) if (value) query[key] = value;
  // Never everything: a filter with no field would revoke every family in the system.
  if (Object.keys(query).length === 1) return 0;
  const result = await LotteryRefreshCredentialModel.updateMany(query, {
    $set: { status: "revoked", revokedAt: new Date(), revokedReason: reason }
  });
  return Number(result.modifiedCount ?? 0);
}

/**
 * The hooks: whatever takes a person's access away ends their lottery credentials too. Awaited but
 * never allowed to fail the admin action that called it: the refresh route re-checks the person on
 * every use anyway, so a missed revoke is caught within one refresh.
 */
export async function revokePersonLottery(appUserId: string, reason: RevokeReason, storeId?: string): Promise<void> {
  try {
    await revokeRefreshFamilies({ appUserId, ...(storeId ? { storeId } : {}) }, reason);
  } catch (error) {
    console.warn(`[lottery] revoke for ${appUserId} (${reason}) did not land: ${error instanceof Error ? error.name : "Error"}`);
  }
}

export type FamilyCheck =
  | { ok: true; family: Doc; presentedHash: string }
  | { ok: false; error: ControlPlaneError };

const invalid = () => new ControlPlaneError(401, "REFRESH_INVALID", "Sign in again.");

/**
 * What a revoked family answers to someone who really holds one of its generations. Saying why is
 * what lets the PC do the right thing — "Lottery moved", delete the person, or only sign in again.
 * A caller who holds nothing real only ever hears REFRESH_INVALID.
 */
function revokedAnswer(reason: string): ControlPlaneError {
  switch (reason) {
    case "reuse":
      return new ControlPlaneError(401, "REFRESH_REUSED", "Sign in again.");
    case "expired":
      return new ControlPlaneError(401, "REFRESH_EXPIRED", "Sign in again.");
    case "pc_replaced":
      return new ControlPlaneError(409, "PC_REPLACED", "Lottery moved to another PC.");
    case "pc_unbound":
      return new ControlPlaneError(409, "PC_NOT_BOUND", "This PC is not the store's lottery PC any more.");
    case "account_disabled":
      return new ControlPlaneError(403, "ACCOUNT_DISABLED", "This account has been turned off. Ask your manager.");
    case "assignment_removed":
    case "no_lottery_access":
      return new ControlPlaneError(403, "NO_LOTTERY_ACCESS", "You can't use StoreDesk Lottery at this store.");
    default:
      return invalid();
  }
}

/**
 * Find the family a presented credential belongs to and decide whether it may be rotated. Reuse of
 * an older generation revokes the family here, with an audit line.
 */
export async function checkRefreshCredential(raw: string, pcId: string): Promise<FamilyCheck> {
  await connectDb();
  const parsed = parseRefreshCredential(raw);
  if (!parsed) return { ok: false, error: invalid() };
  const family = (await LotteryRefreshCredentialModel.findOne({ familyId: parsed.familyId })
    .select("+hash +previousHashes")
    .lean()) as Doc | null;
  if (!family) return { ok: false, error: invalid() };

  const presentedHash = sha256(parsed.secret);
  const current = constantTimeEqual(String(family.hash), presentedHash);
  const previous = ((family.previousHashes as string[] | undefined) ?? []).some((hash) => constantTimeEqual(hash, presentedHash));
  // Neither the current generation nor a remembered one: a guess, and it learns nothing.
  if (!current && !previous) return { ok: false, error: invalid() };
  // The credential is bound to the PC it was issued to.
  if (String(family.pcId ?? "") !== pcId) return { ok: false, error: invalid() };

  if (family.status !== "active") return { ok: false, error: revokedAnswer(String(family.revokedReason ?? "")) };

  if (previous && !current) {
    await revokeRefreshFamilies({ familyId: parsed.familyId }, "reuse");
    await writeAudit({
      storeId: String(family.storeId),
      actorType: "system",
      actorId: "lottery_refresh",
      action: "lottery.refresh_reused",
      targetType: "app_user",
      targetId: String(family.appUserId),
      metadata: { familyId: parsed.familyId, pcId, generation: family.generation }
    });
    return { ok: false, error: revokedAnswer("reuse") };
  }

  const now = Date.now();
  const idle = new Date(String(family.idleExpiresAt)).getTime();
  const absolute = new Date(String(family.absoluteExpiresAt)).getTime();
  if (idle <= now || absolute <= now) {
    await revokeRefreshFamilies({ familyId: parsed.familyId }, "expired");
    return { ok: false, error: revokedAnswer("expired") };
  }
  return { ok: true, family, presentedHash };
}

/**
 * Rotate: the presented generation becomes a remembered one and a new secret takes its place, in
 * one conditional write. Losing a race to a second use of the same credential is reuse.
 */
export async function rotateRefreshCredential(family: Doc, presentedHash: string): Promise<string> {
  const familyId = String(family.familyId);
  const secret = newSecret();
  const now = new Date();
  const absolute = new Date(String(family.absoluteExpiresAt));
  const idle = new Date(Math.min(now.getTime() + IDLE_DAYS * DAY_MS, absolute.getTime()));
  const updated = await LotteryRefreshCredentialModel.findOneAndUpdate(
    { familyId, hash: presentedHash, status: "active" },
    {
      $set: { hash: sha256(secret), lastUsedAt: now, idleExpiresAt: idle },
      $inc: { generation: 1 },
      $push: { previousHashes: { $each: [presentedHash], $slice: -REMEMBERED } }
    },
    { returnDocument: "after" }
  ).lean();
  if (!updated) {
    await revokeRefreshFamilies({ familyId }, "reuse");
    throw revokedAnswer("reuse");
  }
  return `lrt_${familyId}.${secret}`;
}

/**
 * Sign-out: revoke the family the credential belongs to, if the caller really holds a generation
 * of it. Answers nothing either way, so the call cannot be used to probe.
 */
export async function signOutRefreshCredential(raw: string): Promise<void> {
  await connectDb();
  const parsed = parseRefreshCredential(raw);
  if (!parsed) return;
  const family = (await LotteryRefreshCredentialModel.findOne({ familyId: parsed.familyId })
    .select("+hash +previousHashes")
    .lean()) as Doc | null;
  if (!family || family.status !== "active") return;
  const presentedHash = sha256(parsed.secret);
  const holds =
    constantTimeEqual(String(family.hash), presentedHash) ||
    ((family.previousHashes as string[] | undefined) ?? []).some((hash) => constantTimeEqual(hash, presentedHash));
  if (!holds) return;
  await revokeRefreshFamilies({ familyId: parsed.familyId }, "signed_out");
}
