import { z } from "zod";
import { connectDb } from "@/lib/db";
import { removeStoreTunnel } from "@/lib/tunnel";
import {
  AppUserModel,
  ClientDeviceModel,
  OrganizationModel,
  SetupKeyModel,
  SubscriptionModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerCredentialModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";
import { auditAdmin } from "@/lib/audit";
import { notFound, optionalEmail } from "@/lib/http";
import { normalizeRoles, toIsoOr } from "@/lib/roles";
import { templateRoles } from "@/lib/role-templates";
import { revokeInstallationsAndNotify, scheduleNotify } from "@/lib/store-notify";
import {
  ENTITLED_STATUSES,
  SubscriptionCreateSchema,
  createSubscription,
  expireLapsedSubscriptions,
  subscriptionView,
  type SubscriptionView
} from "@/lib/subscriptions";
import type { InternalAdminActor } from "@/lib/admin-auth";

type Doc = Record<string, unknown>;

/**
 * The org tag phones type (P15): 1–40 lower-case letters, digits and
 * hyphens, not starting or ending with a hyphen. Enforced on create and edit;
 * older slugs that don't match keep working for lookup.
 */
export const ORG_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SLUG_MESSAGE =
  "The org tag must be 1–40 lower-case letters, digits and hyphens, not starting or ending with a hyphen";

export const slugSchema = z.string().trim().toLowerCase().regex(ORG_SLUG, SLUG_MESSAGE);

export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const iso = (value: unknown): string | null => (value ? toIsoOr(value, "") || null : null);

export function organizationView(org: Doc) {
  return {
    organizationId: String(org.organizationId),
    name: String(org.name),
    slug: String(org.slug),
    billingEmail: org.billingEmail ? String(org.billingEmail) : null,
    status: String(org.status ?? "active"),
    createdAt: iso(org.createdAt),
    updatedAt: iso(org.updatedAt)
  };
}

export async function requireOrganization(organizationId: string): Promise<Doc> {
  await connectDb();
  const org = (await OrganizationModel.findOne({ organizationId }).lean()) as Doc | null;
  if (!org) throw notFound("Organization");
  return org;
}

async function assertSlugFree(slug: string, exceptOrganizationId?: string) {
  const taken = await OrganizationModel.findOne({
    slug,
    ...(exceptOrganizationId ? { organizationId: { $ne: exceptOrganizationId } } : {})
  }).lean();
  if (taken) throw new ControlPlaneError(409, "SLUG_TAKEN", `The org tag "${slug}" is already in use`);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

export const OrganizationCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  billingEmail: optionalEmail.optional(),
  /** Optional: the first subscription, created in the same request. */
  subscription: SubscriptionCreateSchema.optional()
});
export type OrganizationCreate = z.output<typeof OrganizationCreateSchema>;

export const OrganizationPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    status: z.enum(["active", "suspended"]).optional(),
    billingEmail: optionalEmail.optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to change" });
export type OrganizationPatch = z.output<typeof OrganizationPatchSchema>;

export const OrganizationDeleteSchema = z.object({ confirmSlug: z.string().trim().min(1) });

// ── Reads ────────────────────────────────────────────────────────────────────

function currentSubscription(subscriptions: Doc[]): Doc | null {
  const entitled = subscriptions
    .filter((sub) => ENTITLED_STATUSES.includes(String(sub.status)))
    .sort((a, b) => new Date(String(b.entitlementExpiresAt)).getTime() - new Date(String(a.entitlementExpiresAt)).getTime());
  if (entitled[0]) return entitled[0];
  return (
    [...subscriptions].sort(
      (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
    )[0] ?? null
  );
}

export async function listOrganizations() {
  await connectDb();
  await expireLapsedSubscriptions();
  const [orgs, stores, subscriptions, assignments] = (await Promise.all([
    OrganizationModel.find({}).sort({ createdAt: -1 }).lean(),
    TenantStoreModel.aggregate([{ $group: { _id: "$organizationId", count: { $sum: 1 } } }]),
    SubscriptionModel.find({}).lean(),
    UserAssignmentModel.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: { org: "$organizationId", user: "$appUserId" } } },
      { $group: { _id: "$_id.org", count: { $sum: 1 } } }
    ])
  ])) as [Doc[], Array<{ _id: string; count: number }>, Doc[], Array<{ _id: string; count: number }>];
  const storeCount = new Map(stores.map((row) => [row._id, row.count]));
  const userCount = new Map(assignments.map((row) => [row._id, row.count]));
  return orgs.map((org) => {
    const organizationId = String(org.organizationId);
    const current = currentSubscription(subscriptions.filter((sub) => sub.organizationId === organizationId));
    return {
      ...organizationView(org),
      storeCount: storeCount.get(organizationId) ?? 0,
      userCount: userCount.get(organizationId) ?? 0,
      subscriptionStatus: current ? String(current.status) : null,
      subscriptionEndsAt: current ? iso(current.entitlementExpiresAt) : null
    };
  });
}

export async function getOrganizationDetail(organizationId: string) {
  const org = await requireOrganization(organizationId);
  await expireLapsedSubscriptions({ organizationId });
  const [stores, users, subscriptions] = await Promise.all([
    TenantStoreModel.countDocuments({ organizationId }),
    UserAssignmentModel.distinct("appUserId", { organizationId, status: "active" }),
    SubscriptionModel.find({ organizationId }).lean()
  ]);
  const current = currentSubscription(subscriptions as Doc[]);
  return {
    organization: organizationView(org),
    counts: {
      stores,
      roles: normalizeRoles(org.roles, toIsoOr(org.createdAt, "1970-01-01T00:00:00.000Z")).length,
      users: users.length,
      subscriptions: subscriptions.length
    },
    subscription: current ? subscriptionView(current) : null
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createOrganization(
  admin: InternalAdminActor,
  body: OrganizationCreate
): Promise<{ organization: ReturnType<typeof organizationView>; subscription: SubscriptionView | null }> {
  await connectDb();
  const slug = body.slug ?? suggestSlug(body.name);
  if (!ORG_SLUG.test(slug)) {
    throw new ControlPlaneError(400, "SLUG_INVALID", `slug: ${SLUG_MESSAGE}`);
  }
  await assertSlugFree(slug);
  const organizationId = publicId("org");
  const doc = await OrganizationModel.create({
    organizationId,
    name: body.name,
    slug,
    billingEmail: body.billingEmail ?? undefined,
    status: "active",
    // The four templates, at version 1 (P9): assignments always name a real role.
    roles: templateRoles(new Date())
  });
  await auditAdmin(admin, {
    organizationId,
    action: "organization.create",
    targetType: "organization",
    targetId: organizationId,
    metadata: { name: body.name, slug }
  });
  const subscription = body.subscription
    ? await createSubscription(admin, organizationId, body.subscription)
    : null;
  return { organization: organizationView(doc.toObject() as Doc), subscription };
}

export async function updateOrganization(
  admin: InternalAdminActor,
  organizationId: string,
  body: OrganizationPatch
) {
  const org = await requireOrganization(organizationId);
  if (body.slug && body.slug !== org.slug) await assertSlugFree(body.slug, organizationId);
  const set: Doc = {};
  const unset: Doc = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.slug !== undefined) set.slug = body.slug;
  if (body.status !== undefined) set.status = body.status;
  if (body.billingEmail !== undefined) {
    if (body.billingEmail) set.billingEmail = body.billingEmail;
    else unset.billingEmail = 1;
  }
  const updated = (await OrganizationModel.findOneAndUpdate(
    { organizationId },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after", runValidators: true }
  ).lean()) as Doc;
  const changed = Object.keys(body).filter(
    (key) => String((org as Doc)[key] ?? "") !== String((updated as Doc)[key] ?? "")
  );
  await auditAdmin(admin, {
    organizationId,
    action: "organization.update",
    targetType: "organization",
    targetId: organizationId,
    metadata: { changed, ...(changed.includes("status") ? { status: updated.status, previousStatus: org.status } : {}) }
  });
  // Name, slug and status are in every store's access sync; a suspension
  // makes the next pull answer 403 STORE_SUSPENDED.
  if (changed.some((key) => key === "name" || key === "slug" || key === "status")) {
    scheduleNotify({ organizationId, reason: "organization.update" });
  }
  return organizationView(updated);
}

/**
 * Delete an organization and everything under it (P5). Guarded by typing the
 * slug. Every delete is by an explicit id list collected first — never by a
 * filter on a field a model may not have (the old `AppUser.deleteMany
 * ({organizationId})` matched every user, since AppUser has no such field).
 *
 * Logins that belong to another organization too are kept; only their
 * assignments here go. Audit events are kept: they are the record of what
 * happened.
 */
export async function deleteOrganization(admin: InternalAdminActor, organizationId: string, confirmSlug: string) {
  const org = await requireOrganization(organizationId);
  if (confirmSlug.trim().toLowerCase() !== String(org.slug)) {
    throw new ControlPlaneError(400, "CONFIRM_SLUG_MISMATCH", "Type the organization's org tag exactly to delete it");
  }

  const [stores, installations, subscriptions, assignments] = (await Promise.all([
    TenantStoreModel.find({ organizationId }).select("storeId tunnelUrl tunnelLabel tunnelId tunnelDnsRecordId").lean(),
    WorkerInstallationModel.find({ organizationId }).select("workerInstallationId").lean(),
    SubscriptionModel.find({ organizationId }).select("subscriptionId").lean(),
    UserAssignmentModel.find({ organizationId }).select("assignmentId appUserId").lean()
  ])) as [Doc[], Doc[], Doc[], Doc[]];
  const storeIds = stores.map((store) => String(store.storeId));
  const installationIds = installations.map((row) => String(row.workerInstallationId));
  const subscriptionIds = subscriptions.map((row) => String(row.subscriptionId));
  const assignmentIds = assignments.map((row) => String(row.assignmentId));
  const memberIds = [...new Set(assignments.map((row) => String(row.appUserId)))];
  const elsewhere = new Set(
    (await UserAssignmentModel.distinct("appUserId", {
      appUserId: { $in: memberIds },
      organizationId: { $ne: organizationId }
    })) as string[]
  );
  const orphanUserIds = memberIds.filter((id) => !elsewhere.has(id));

  // Revoke first: every credential is revoked and each store server told (it
  // pulls, gets 401, and turns sign-in off) before anything is deleted — and
  // before the tunnels the notify travels through are removed. A failed
  // revoke throws and stops the delete.
  await revokeInstallationsAndNotify({ organizationId, reason: "organization.delete" });

  // By the stored Cloudflare ids only; older name-only tunnels are listed for manual cleanup.
  const tunnelsNeedManualCleanup: string[] = [];
  for (const store of stores) {
    const outcome = await removeStoreTunnel(store);
    if (outcome.manualCleanup) tunnelsNeedManualCleanup.push(outcome.manualCleanup);
  }

  const byIds = <T>(ids: T[]) => ({ $in: ids });
  const results = await Promise.all([
    SetupKeyModel.deleteMany({ workerInstallationId: byIds(installationIds) }),
    SetupKeyModel.deleteMany({ storeId: byIds(storeIds) }),
    WorkerCredentialModel.deleteMany({ workerInstallationId: byIds(installationIds) }),
    WorkerInstallationModel.deleteMany({ workerInstallationId: byIds(installationIds) }),
    UserAssignmentModel.deleteMany({ assignmentId: byIds(assignmentIds) }),
    ClientDeviceModel.deleteMany({ appUserId: byIds(orphanUserIds) }),
    AppUserModel.deleteMany({ appUserId: byIds(orphanUserIds) }),
    TenantStoreModel.deleteMany({ storeId: byIds(storeIds) }),
    SubscriptionModel.deleteMany({ subscriptionId: byIds(subscriptionIds) })
  ]);
  await OrganizationModel.deleteOne({ organizationId });

  const counts = {
    stores: storeIds.length,
    installations: installationIds.length,
    subscriptions: subscriptionIds.length,
    assignments: assignmentIds.length,
    usersDeleted: Number(results[6].deletedCount ?? 0),
    usersKept: memberIds.length - orphanUserIds.length,
    tunnelsNeedManualCleanup
  };
  await auditAdmin(admin, {
    organizationId,
    action: "organization.delete",
    targetType: "organization",
    targetId: organizationId,
    metadata: { name: org.name, slug: org.slug, ...counts }
  });
  return { deleted: organizationId, counts };
}

/** The tunnel's hostname label: stored since this build, else the URL's first label. */
export function tunnelLabelOf(store: Doc): string | null {
  if (typeof store.tunnelLabel === "string" && store.tunnelLabel) return store.tunnelLabel;
  if (typeof store.tunnelUrl === "string" && store.tunnelUrl) {
    try {
      return new URL(store.tunnelUrl).hostname.split(".")[0] || null;
    } catch {
      return null;
    }
  }
  return null;
}
