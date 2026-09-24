import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  AuditEventModel,
  InternalAdminModel,
  LicenseModel,
  OrganizationModel,
  SetupKeyModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { getPage, type App, type StoreCapability } from "@/config/pages";
import { normalizeRoles, toIsoOr, type OrgRole } from "@/lib/roles";
import { normalizeStoreSettings, type StoreCapabilities } from "@/lib/store-settings";
import { requireOrganization } from "@/lib/organizations";
import { requireStore } from "@/lib/tenant-stores";
import { ENTITLED_STATUSES, coverageIndex, expireLapsedLicenses } from "@/lib/licenses";
import { tunnelView } from "@/lib/tunnel";
import { remoteStatuses } from "@/lib/remote-status";

type Doc = Record<string, unknown>;
const EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const iso = (value: unknown): string | null => (value ? toIsoOr(value, "") || null : null);

// ── Access preview (roles × store features) ──────────────────────────────────

export type PreviewPage = {
  key: string;
  label: string;
  requiresCapability: StoreCapability | null;
  /** The capability the store lacks, when the role grants the page but the store hides it. */
  hiddenBecause: StoreCapability | null;
  allowed: boolean;
};

/** The pages a role grants in one app, each marked allowed or hidden at this store. */
export function effectivePages(
  role: OrgRole,
  app: App,
  capabilities: StoreCapabilities
): PreviewPage[] {
  // A role stored before an app existed has no block for it, and grants nothing there.
  return (role.accessKeys[app]?.pages ?? [])
    .filter((page) => page.enabled)
    .map((page) => {
      const def = getPage(page.key);
      const requires = def?.app === app ? (def.requiresCapability ?? null) : null;
      // As both apps: a page that needs a capability shows only on a literal true (not answered or no hides it;
      // store-desk-electron navModel.hasCapability, store-desk-mobile drawer_model.dart).
      const hidden = requires && capabilities[requires] !== true ? requires : null;
      return { key: page.key, label: def?.label ?? page.key, requiresCapability: requires, hiddenBecause: hidden, allowed: !hidden };
    });
}

export async function accessPreview(storeId: string) {
  const store = await requireStore(storeId);
  const organizationId = String(store.organizationId);
  const org = await requireOrganization(organizationId);
  const capabilities = normalizeStoreSettings(store.settings).capabilities;
  const roles = normalizeRoles(org.roles, toIsoOr(org.createdAt, EPOCH));
  const assignments = (await UserAssignmentModel.find({
    organizationId,
    status: "active",
    storeId
  }).lean()) as Doc[];
  const users = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const set = users.get(String(assignment.role)) ?? new Set<string>();
    set.add(String(assignment.appUserId));
    users.set(String(assignment.role), set);
  }
  return {
    store: { storeId, name: String(store.name) },
    capabilities,
    roles: roles.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      version: role.version,
      userCount: users.get(role.roleId)?.size ?? 0,
      electron: effectivePages(role, "electron", capabilities),
      mobile: effectivePages(role, "mobile", capabilities),
      lottery: effectivePages(role, "lottery", capabilities)
    }))
  };
}

// ── Audit ────────────────────────────────────────────────────────────────────

/** Store pulls are audited on every sync; the activity views leave them out unless asked. */
const NOISY_ACTIONS = ["edge.access_sync"];

async function labelEvents(events: Doc[]) {
  const adminIds = new Set<string>();
  const storeIds = new Set<string>();
  const userIds = new Set<string>();
  const orgIds = new Set<string>();
  const licenseIds = new Set<string>();
  for (const event of events) {
    if (event.actorType === "internal_admin") adminIds.add(String(event.actorId));
    if (event.storeId) storeIds.add(String(event.storeId));
    if (event.targetType === "store") storeIds.add(String(event.targetId));
    if (event.targetType === "app_user") userIds.add(String(event.targetId));
    if (event.targetType === "license") licenseIds.add(String(event.targetId));
    orgIds.add(String(event.organizationId));
  }
  const [admins, stores, users, orgs, licenses] = (await Promise.all([
    InternalAdminModel.find({ adminId: { $in: [...adminIds] } }).select("adminId email").lean(),
    TenantStoreModel.find({ storeId: { $in: [...storeIds] } }).select("storeId name").lean(),
    AppUserModel.find({ appUserId: { $in: [...userIds] } }).select("appUserId email").lean(),
    OrganizationModel.find({ organizationId: { $in: [...orgIds] } }).select("organizationId name").lean(),
    LicenseModel.find({ licenseId: { $in: [...licenseIds] } }).select("licenseId licenseNumber").lean()
  ])) as [Doc[], Doc[], Doc[], Doc[], Doc[]];
  const adminEmail = new Map(admins.map((row) => [String(row.adminId), String(row.email)]));
  const storeName = new Map(stores.map((row) => [String(row.storeId), String(row.name)]));
  const userEmail = new Map(users.map((row) => [String(row.appUserId), String(row.email)]));
  const orgName = new Map(orgs.map((row) => [String(row.organizationId), String(row.name)]));
  const licenseNumber = new Map(licenses.map((row) => [String(row.licenseId), String(row.licenseNumber)]));
  return events.map((event) => {
    const actorId = String(event.actorId);
    const targetId = String(event.targetId);
    const storeId = event.storeId ? String(event.storeId) : null;
    const metadata = (event.metadata as Doc) ?? {};
    const actorLabel =
      event.actorType === "internal_admin"
        ? (adminEmail.get(actorId) ?? actorId)
        : event.actorType === "worker"
          ? `Store PC${storeId && storeName.get(storeId) ? ` (${storeName.get(storeId)})` : ""}`
          : actorId;
    const targetLabel =
      event.targetType === "store"
        ? (storeName.get(targetId) ?? null)
        : event.targetType === "app_user"
          ? (userEmail.get(targetId) ?? null)
          : event.targetType === "organization"
            ? (orgName.get(targetId) ?? null)
            : event.targetType === "license"
              ? (licenseNumber.get(targetId) ?? (typeof metadata.licenseNumber === "string" ? metadata.licenseNumber : null))
              : null;
    return {
      auditEventId: String(event.auditEventId),
      occurredAt: iso(event.occurredAt),
      organizationId: String(event.organizationId),
      organizationName: orgName.get(String(event.organizationId)) ?? null,
      storeId,
      storeName: storeId ? (storeName.get(storeId) ?? null) : null,
      actorType: String(event.actorType),
      actorId,
      actorLabel,
      action: String(event.action),
      targetType: String(event.targetType),
      targetId,
      targetLabel,
      reason: event.reason ? String(event.reason) : null,
      metadata
    };
  });
}

export type AuditQuery = { cursor?: string | null; action?: string | null; limit?: number };

/**
 * One organization's activity, newest first. `cursor` is opaque (the last
 * event's database id); pass `nextCursor` back to get the next page.
 */
export async function listAudit(organizationId: string, query: AuditQuery) {
  await requireOrganization(organizationId);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const filter: Doc = { organizationId };
  if (query.action) filter.action = query.action;
  else filter.action = { $nin: NOISY_ACTIONS };
  if (query.cursor) {
    if (!mongoose.isValidObjectId(query.cursor)) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "cursor: not a cursor from this list");
    }
    filter._id = { $lt: new mongoose.Types.ObjectId(query.cursor) };
  }
  const rows = (await AuditEventModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean()) as Doc[];
  const page = rows.slice(0, limit);
  const [events, actions] = await Promise.all([
    labelEvents(page),
    AuditEventModel.distinct("action", { organizationId })
  ]);
  return {
    events,
    nextCursor: rows.length > limit ? String(page[page.length - 1]._id) : null,
    actions: (actions as string[]).sort()
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

const PENDING_INSTALL = ["not_installed", "installed", "awaiting_activation"];
const LIVE_INSTALL = ["active", "degraded", "updating", "rollback"];
const ONLINE_WINDOW_MS = 10 * 60_000;
const OFFLINE_AFTER_MS = 24 * 60 * 60_000;
const ENDING_WINDOW_MS = 30 * DAY_MS;
/** A tunnel down longer than this needs attention. */
const TUNNEL_DOWN_AFTER_MS = 15 * 60_000;

export type AttentionItem = {
  kind: "pc_not_activated" | "license_ending" | "store_unlicensed" | "tunnel_failed" | "tunnel_down" | "store_offline";
  organizationId: string;
  organizationName: string;
  storeId: string | null;
  storeName: string | null;
  licenseId: string | null;
  licenseNumber: string | null;
  at: string | null;
  message: string;
};

function daysAgo(date: Date, now: number): string {
  const days = Math.floor((now - date.getTime()) / DAY_MS);
  return days <= 0 ? "today" : days === 1 ? "1 d ago" : `${days} d ago`;
}

export async function dashboard() {
  await connectDb();
  await expireLapsedLicenses();
  const now = Date.now();
  const [orgs, stores, installations, index] = (await Promise.all([
    OrganizationModel.find({}).select("organizationId name status").lean(),
    TenantStoreModel.find({}).lean(),
    WorkerInstallationModel.find({}).lean(),
    coverageIndex()
  ])) as [Doc[], Doc[], Doc[], Awaited<ReturnType<typeof coverageIndex>>];
  const orgById = new Map(orgs.map((org) => [String(org.organizationId), org]));
  const storeById = new Map(stores.map((store) => [String(store.storeId), store]));
  // Only licenses that cover under their organization's mode: the master of a
  // master-mode organization, the store licenses of a store-wise one.
  const licenses = index.licenses.filter(
    (license) => license.status !== "cancelled" && Boolean(license.storeId)
  );
  const live = installations.filter((row) => LIVE_INSTALL.includes(String(row.status)));
  const online = live.filter((row) => row.lastSeenAt && now - new Date(String(row.lastSeenAt)).getTime() <= ONLINE_WINDOW_MS);

  const activeOrg = (organizationId: string) => orgById.get(organizationId)?.status !== "suspended";
  const item = (partial: Omit<AttentionItem, "organizationName" | "licenseId" | "licenseNumber"> & Partial<AttentionItem>): AttentionItem => ({
    licenseId: null,
    licenseNumber: null,
    ...partial,
    organizationName: String(orgById.get(partial.organizationId)?.name ?? partial.organizationId)
  });
  const attention: AttentionItem[] = [];

  // Stores each license covers, and stores with none.
  const coveredCount = new Map<string, number>();
  const unlicensed: Doc[] = [];
  for (const store of stores) {
    const license = index.licenseFor(store);
    if (license) {
      coveredCount.set(String(license.licenseId), (coveredCount.get(String(license.licenseId)) ?? 0) + 1);
    } else if (store.status === "active" && activeOrg(String(store.organizationId))) {
      unlicensed.push(store);
    }
  }

  const pending = installations.filter(
    (row) => PENDING_INSTALL.includes(String(row.status)) && activeOrg(String(row.organizationId))
  );
  const keys = (await SetupKeyModel.find({ workerInstallationId: { $in: pending.map((row) => row.workerInstallationId) } })
    .sort({ createdAt: -1 })
    .lean()) as Doc[];
  for (const installation of pending) {
    const key = keys.find((row) => row.workerInstallationId === installation.workerInstallationId);
    const store = storeById.get(String(installation.storeId));
    const issued = key?.createdAt ? new Date(String(key.createdAt)) : null;
    const expired = key && new Date(String(key.expiresAt)).getTime() <= now;
    attention.push(
      item({
        kind: "pc_not_activated",
        organizationId: String(installation.organizationId),
        storeId: String(installation.storeId),
        storeName: store ? String(store.name) : null,
        at: issued ? issued.toISOString() : iso(installation.createdAt),
        message: !key
          ? "PC not activated (no setup key issued)"
          : key.status === "consumed"
            ? "PC not activated"
            : expired
              ? `PC not activated (setup key expired, issued ${daysAgo(issued!, now)})`
              : `PC not activated (key issued ${daysAgo(issued!, now)})`
      })
    );
  }

  // Licenses in force ending within 30 days, and lapsed ones still covering stores.
  const ending = licenses.filter((license) => {
    const ends = new Date(String(license.entitlementExpiresAt)).getTime();
    return ENTITLED_STATUSES.includes(String(license.status)) && ends - now <= ENDING_WINDOW_MS;
  });
  const lapsed = licenses.filter((license) => license.status === "expired" && (coveredCount.get(String(license.licenseId)) ?? 0) > 0);
  for (const license of [...ending, ...lapsed]) {
    if (!activeOrg(String(license.organizationId))) continue;
    const ends = new Date(String(license.entitlementExpiresAt));
    const store = license.storeId ? storeById.get(String(license.storeId)) : undefined;
    const number = String(license.licenseNumber);
    const covered = coveredCount.get(String(license.licenseId)) ?? 0;
    attention.push(
      item({
        kind: "license_ending",
        organizationId: String(license.organizationId),
        storeId: license.storeId ? String(license.storeId) : null,
        storeName: store ? String(store.name) : null,
        licenseId: String(license.licenseId),
        licenseNumber: number,
        at: ends.toISOString(),
        message:
          ends.getTime() > now
            ? `${license.scope === "organization" ? "Master license" : "License"} ${number} ends ${ends.toISOString().slice(0, 10)}${license.scope === "organization" ? ` (${covered} store${covered === 1 ? "" : "s"})` : ""}`
            : `License ${number} ended ${ends.toISOString().slice(0, 10)}`
      })
    );
  }

  for (const store of unlicensed) {
    attention.push(
      item({
        kind: "store_unlicensed",
        organizationId: String(store.organizationId),
        storeId: String(store.storeId),
        storeName: String(store.name),
        at: null,
        message: "Unlicensed — the PC can't activate and sign-in is refused"
      })
    );
  }

  for (const store of stores) {
    if (store.status !== "active" || !activeOrg(String(store.organizationId))) continue;
    const tunnel = tunnelView(store);
    if (tunnel.status === "failed" || tunnel.status === "missing") {
      attention.push(
        item({
          kind: "tunnel_failed",
          organizationId: String(store.organizationId),
          storeId: String(store.storeId),
          storeName: String(store.name),
          at: tunnel.updatedAt,
          message: tunnel.status === "failed" ? `Tunnel failed: ${tunnel.message}` : "No tunnel"
        })
      );
    }
  }

  // Phones can't reach the store: its tunnel has been down for 15 minutes or more.
  const reachable = stores.filter((store) => store.status === "active" && activeOrg(String(store.organizationId)));
  const remote = await remoteStatuses(reachable);
  for (const store of reachable) {
    const status = remote.get(String(store.storeId));
    if (status?.status !== "offline" || !status.since) continue;
    if (now - new Date(status.since).getTime() < TUNNEL_DOWN_AFTER_MS) continue;
    attention.push(
      item({
        kind: "tunnel_down",
        organizationId: String(store.organizationId),
        storeId: String(store.storeId),
        storeName: String(store.name),
        at: status.since,
        message: "Tunnel down — phones can't reach this store"
      })
    );
  }

  for (const installation of live) {
    const store = storeById.get(String(installation.storeId));
    if (!store || store.status !== "active" || !activeOrg(String(installation.organizationId))) continue;
    const seen = installation.lastSeenAt ? new Date(String(installation.lastSeenAt)) : null;
    if (!seen || now - seen.getTime() > OFFLINE_AFTER_MS) {
      attention.push(
        item({
          kind: "store_offline",
          organizationId: String(installation.organizationId),
          storeId: String(installation.storeId),
          storeName: String(store.name),
          at: seen ? seen.toISOString() : null,
          message: seen ? `PC last seen ${daysAgo(seen, now)}` : "PC has not checked in since activation"
        })
      );
    }
  }

  const recent = (await AuditEventModel.find({ action: { $nin: NOISY_ACTIONS } })
    .sort({ _id: -1 })
    .limit(20)
    .lean()) as Doc[];

  return {
    counts: {
      organizations: orgs.length,
      stores: stores.length,
      pcsOnline: online.length,
      pcsTotal: live.length,
      licensesEndingSoon: ending.length,
      unlicensedStores: unlicensed.length
    },
    attention: attention.slice(0, 100),
    recentActivity: await labelEvents(recent)
  };
}
