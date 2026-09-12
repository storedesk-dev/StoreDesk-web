import { z } from "zod";
import { connectDb } from "@/lib/db";
import {
  OrganizationModel,
  SubscriptionModel,
  TenantStoreModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { scheduleNotify } from "@/lib/store-notify";
import type { InternalAdminActor } from "@/lib/admin-auth";

/**
 * Subscriptions (P11): created, edited, renewed, suspended and cancelled here,
 * every change audited and pushed to the stores on the subscription.
 *
 * `maxStores` counts the stores on this subscription; `maxWorkerInstallations`
 * is per store. `expired` is written by a check on read once the entitlement
 * date has passed (expireLapsedSubscriptions).
 */

export const ENTITLED_STATUSES = ["trialing", "active"];
const DAY_MS = 86_400_000;

type Doc = Record<string, unknown>;

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function isEntitled(subscription: Doc | null | undefined, now = new Date()): boolean {
  if (!subscription) return false;
  const ends = asDate(subscription.entitlementExpiresAt);
  return ENTITLED_STATUSES.includes(String(subscription.status)) && Boolean(ends && ends > now);
}

/** Why a subscription does not entitle anything, in words an operator can act on. */
export function entitlementProblem(subscription: Doc | null | undefined, now = new Date()): string | null {
  if (!subscription) return "The store has no subscription.";
  const status = String(subscription.status);
  if (!ENTITLED_STATUSES.includes(status)) return `The subscription is ${status}.`;
  const ends = asDate(subscription.entitlementExpiresAt);
  if (!ends || ends <= now) return "The subscription's entitlement has ended; renew it first.";
  return null;
}

/** The check on read: an entitled subscription past its date becomes `expired`. */
export async function expireLapsedSubscriptions(filter: Doc = {}): Promise<number> {
  await connectDb();
  const result = await SubscriptionModel.updateMany(
    { ...filter, status: { $in: ENTITLED_STATUSES }, entitlementExpiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
  return Number(result.modifiedCount ?? 0);
}

const iso = (value: unknown): string | null => asDate(value)?.toISOString() ?? null;

export function subscriptionView(subscription: Doc, storeCount = 0) {
  const ends = asDate(subscription.entitlementExpiresAt);
  return {
    subscriptionId: String(subscription.subscriptionId),
    organizationId: String(subscription.organizationId),
    plan: String(subscription.plan),
    status: String(subscription.status),
    startsAt: iso(subscription.startsAt),
    entitlementExpiresAt: iso(subscription.entitlementExpiresAt),
    supportEndsAt: iso(subscription.supportEndsAt),
    daysRemaining: ends ? Math.ceil((ends.getTime() - Date.now()) / DAY_MS) : null,
    offlineGraceDays: typeof subscription.offlineGraceDays === "number" ? subscription.offlineGraceDays : 7,
    maxStores: Number(subscription.maxStores),
    maxWorkerInstallations: Number(subscription.maxWorkerInstallations),
    storeCount,
    createdAt: iso(subscription.createdAt),
    updatedAt: iso(subscription.updatedAt)
  };
}

export type SubscriptionView = ReturnType<typeof subscriptionView>;

// ── Schemas ──────────────────────────────────────────────────────────────────

const dateInput = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected a date, e.g. 2027-09-12T00:00:00Z")
  .transform((value) => new Date(value));

const limits = {
  offlineGraceDays: z.number().int().min(0).max(30),
  maxStores: z.number().int().min(1).max(1000),
  maxWorkerInstallations: z.number().int().min(1).max(50)
};

export const SubscriptionCreateSchema = z
  .object({
    plan: z.enum(["trial", "standard", "custom"]),
    status: z.enum(["trialing", "active"]).optional(),
    entitlementDays: z.number().int().min(1).max(3650).optional(),
    entitlementExpiresAt: dateInput.optional(),
    offlineGraceDays: limits.offlineGraceDays.optional(),
    maxStores: limits.maxStores.optional(),
    maxWorkerInstallations: limits.maxWorkerInstallations.optional()
  })
  .refine((body) => !(body.entitlementDays && body.entitlementExpiresAt), {
    message: "Give entitlementDays or entitlementExpiresAt, not both"
  });
export type SubscriptionCreate = z.output<typeof SubscriptionCreateSchema>;

export const SubscriptionPatchSchema = z
  .object({
    plan: z.enum(["trial", "standard", "custom"]).optional(),
    status: z.enum(["trialing", "active", "suspended", "cancelled", "expired"]).optional(),
    entitlementExpiresAt: dateInput.optional(),
    renewDays: z.number().int().min(1).max(3650).optional(),
    offlineGraceDays: limits.offlineGraceDays.optional(),
    maxStores: limits.maxStores.optional(),
    maxWorkerInstallations: limits.maxWorkerInstallations.optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" })
  .refine((body) => !(body.renewDays && body.entitlementExpiresAt), {
    message: "Give renewDays or entitlementExpiresAt, not both"
  });
export type SubscriptionPatch = z.output<typeof SubscriptionPatchSchema>;

// ── Reads ────────────────────────────────────────────────────────────────────

async function storeCounts(subscriptionIds: string[]): Promise<Map<string, number>> {
  if (subscriptionIds.length === 0) return new Map();
  const rows = (await TenantStoreModel.aggregate([
    { $match: { subscriptionId: { $in: subscriptionIds } } },
    { $group: { _id: "$subscriptionId", count: { $sum: 1 } } }
  ])) as Array<{ _id: string; count: number }>;
  return new Map(rows.map((row) => [row._id, row.count]));
}

export async function listSubscriptions(organizationId: string): Promise<SubscriptionView[]> {
  await connectDb();
  await expireLapsedSubscriptions({ organizationId });
  const rows = (await SubscriptionModel.find({ organizationId }).sort({ createdAt: -1 }).lean()) as Doc[];
  const counts = await storeCounts(rows.map((row) => String(row.subscriptionId)));
  return rows.map((row) => subscriptionView(row, counts.get(String(row.subscriptionId)) ?? 0));
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createSubscription(
  admin: InternalAdminActor,
  organizationId: string,
  body: SubscriptionCreate
): Promise<SubscriptionView> {
  await connectDb();
  const org = await OrganizationModel.findOne({ organizationId }).lean();
  if (!org) throw notFound("Organization");
  const startsAt = new Date();
  const days = body.entitlementDays ?? (body.plan === "trial" ? 30 : 365);
  const ends = body.entitlementExpiresAt ?? new Date(startsAt.getTime() + days * DAY_MS);
  if (ends <= startsAt) {
    throw new ControlPlaneError(400, "REQUEST_INVALID", "entitlementExpiresAt: must be in the future");
  }
  const subscriptionId = publicId("sub");
  const doc = await SubscriptionModel.create({
    organizationId,
    subscriptionId,
    plan: body.plan,
    status: body.status ?? (body.plan === "trial" ? "trialing" : "active"),
    startsAt,
    supportEndsAt: ends,
    entitlementExpiresAt: ends,
    offlineGraceDays: body.offlineGraceDays ?? 7,
    // Defaults quoted by the public site (lib/site.ts PLANS).
    maxStores: body.maxStores ?? 5,
    maxWorkerInstallations: body.maxWorkerInstallations ?? 5
  });
  await auditAdmin(admin, {
    organizationId,
    action: "subscription.create",
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: { plan: body.plan, entitlementExpiresAt: ends, maxStores: doc.maxStores }
  });
  scheduleNotify({ organizationId, reason: "subscription.create" });
  return subscriptionView(doc.toObject() as Doc, 0);
}

export async function updateSubscription(
  admin: InternalAdminActor,
  organizationId: string,
  subscriptionId: string,
  body: SubscriptionPatch
): Promise<SubscriptionView> {
  await connectDb();
  const current = (await SubscriptionModel.findOne({ organizationId, subscriptionId }).lean()) as Doc | null;
  if (!current) throw notFound("Subscription");
  const now = new Date();
  const set: Doc = {};

  if (body.plan) set.plan = body.plan;
  if (body.offlineGraceDays !== undefined) set.offlineGraceDays = body.offlineGraceDays;

  if (body.renewDays) {
    const currentEnd = asDate(current.entitlementExpiresAt);
    const base = currentEnd && currentEnd > now ? currentEnd : now;
    const ends = new Date(base.getTime() + body.renewDays * DAY_MS);
    set.entitlementExpiresAt = ends;
    set.supportEndsAt = ends;
    // Renewing a lapsed subscription brings it back; a suspended or cancelled
    // one stays as it is until an admin changes its status.
    if (!body.status && current.status === "expired") {
      set.status = (body.plan ?? current.plan) === "trial" ? "trialing" : "active";
    }
  }
  if (body.entitlementExpiresAt) {
    set.entitlementExpiresAt = body.entitlementExpiresAt;
    set.supportEndsAt = body.entitlementExpiresAt;
  }
  if (body.status) set.status = body.status;

  const stores = (await TenantStoreModel.find({ organizationId, subscriptionId }).select("storeId").lean()) as Doc[];
  const storeIds = stores.map((store) => String(store.storeId));
  if (body.maxStores !== undefined) {
    if (body.maxStores < storeIds.length) {
      throw new ControlPlaneError(
        409,
        "LIMIT_BELOW_USAGE",
        `This subscription has ${storeIds.length} stores; move or delete stores before lowering the limit to ${body.maxStores}.`
      );
    }
    set.maxStores = body.maxStores;
  }
  if (body.maxWorkerInstallations !== undefined) {
    if (storeIds.length) {
      const busiest = (await WorkerInstallationModel.aggregate([
        { $match: { organizationId, storeId: { $in: storeIds } } },
        { $group: { _id: "$storeId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])) as Array<{ count: number }>;
      const most = busiest[0]?.count ?? 0;
      if (body.maxWorkerInstallations < most) {
        throw new ControlPlaneError(
          409,
          "LIMIT_BELOW_USAGE",
          `A store on this subscription has ${most} PCs; replace or remove PCs before lowering the limit to ${body.maxWorkerInstallations}.`
        );
      }
    }
    set.maxWorkerInstallations = body.maxWorkerInstallations;
  }

  const resultStatus = String(set.status ?? current.status);
  const resultEnd = asDate(set.entitlementExpiresAt ?? current.entitlementExpiresAt);
  if (ENTITLED_STATUSES.includes(resultStatus) && (!resultEnd || resultEnd <= now)) {
    throw new ControlPlaneError(
      400,
      "ENTITLEMENT_ENDED",
      "The entitlement date has passed; renew or set a future end date to make the subscription active."
    );
  }

  const updated = (await SubscriptionModel.findOneAndUpdate(
    { organizationId, subscriptionId },
    { $set: set },
    { returnDocument: "after", runValidators: true }
  ).lean()) as Doc;

  const action = body.renewDays
    ? "subscription.renew"
    : body.status === "suspended"
      ? "subscription.suspend"
      : body.status === "cancelled"
        ? "subscription.cancel"
        : "subscription.update";
  await auditAdmin(admin, {
    organizationId,
    action,
    targetType: "subscription",
    targetId: subscriptionId,
    metadata: { changes: set, previousStatus: current.status }
  });
  if (storeIds.length) scheduleNotify({ organizationId, storeIds, reason: "subscription.change" });
  return subscriptionView(updated, storeIds.length);
}
