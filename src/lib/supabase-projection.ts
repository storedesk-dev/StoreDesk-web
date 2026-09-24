import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  LicenseModel,
  OrganizationModel,
  TenantStoreModel,
  UserAssignmentModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { coveringFrom, isEntitled } from "@/lib/licenses";
import { readOrganizationRoles } from "@/lib/roles";
import { LOTTERY } from "@/lib/products";

/**
 * What the control plane tells Supabase about a store, and nothing else.
 *
 * This is an **allow-list**, written out field by field. It is not a serializer over a Mongo
 * document, deliberately: a deny-list would quietly start shipping the next field somebody adds to
 * a store, and the fields on a store include its Cloudflare tunnel token and its register password.
 * Neither of those has any business in the lottery cloud, and `projectionFields` below is asserted
 * by a test so it stays that way.
 *
 * Direction is one way. Supabase never writes these rows; the store PC and the phone read them, and
 * RLS reads them to decide who may see what (D-17).
 */

type Doc = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const iso = (value: unknown): string | null => (value ? new Date(String(value)).toISOString() : null);

export interface StoreProjection {
  readonly version: number;
  readonly organization: { id: string; name: string; slug: string; status: string };
  readonly store: {
    id: string;
    organization_id: string;
    name: string;
    store_number: string | null;
    time_zone: string | null;
    state_code: string;
    status: string;
    cloud_mode: string;
  };
  readonly licence: { status: string; expires_at: string | null; number: string | null; scope: string | null; offline_grace_days: number };
  readonly config: ReadonlyArray<{ key: string; value: unknown }>;
  readonly users: ReadonlyArray<{ id: string; email: string; name: string | null; status: string; password_hash: string | null }>;
  readonly access: ReadonlyArray<{ user_id: string; role: string; pages: string[] }>;
  readonly device: { id: string; credential_hash: string | null; status: string; device_name: string | null } | null;
  /** People whose access was taken away: their tokens stop at once. */
  readonly revoked: ReadonlyArray<string>;
}

/** Every field this projection may ever carry. A test walks a built projection against it. */
export const projectionFields = {
  organization: ["id", "name", "slug", "status"],
  store: ["id", "organization_id", "name", "store_number", "time_zone", "state_code", "status", "cloud_mode"],
  licence: ["status", "expires_at", "number", "scope", "offline_grace_days"],
  users: ["id", "email", "name", "status", "password_hash"],
  access: ["user_id", "role", "pages"],
  device: ["id", "credential_hash", "status", "device_name"]
} as const;

/** The five lottery page keys. A role's other pages are StoreDesk's business, not the lottery's. */
const LOTTERY_PAGES = new Set(["lottery", "lotteryClose", "lotteryCorrect", "lotteryReports", "lotterySettings"]);

/**
 * Build one store's projection. The password hash is in it on purpose and only here: it is what
 * lets a lottery PC sign somebody in with the internet down, and `app.app_user_secret` keeps it
 * where only a device can read it.
 */
export async function buildStoreProjection(storeId: string): Promise<StoreProjection | null> {
  await connectDb();
  const store = (await TenantStoreModel.findOne({ storeId }).lean()) as Doc | null;
  if (!store) return null;

  const organizationId = text(store.organizationId);
  const [organization, licences, assignments, installation] = (await Promise.all([
    OrganizationModel.findOne({ organizationId }).lean(),
    LicenseModel.find({ organizationId, status: { $ne: "cancelled" } }).lean(),
    UserAssignmentModel.find({ organizationId }).lean(),
    WorkerInstallationModel.findOne({ storeId, product: LOTTERY }).lean()
  ])) as [Doc | null, Doc[], Doc[], Doc | null];
  if (!organization) return null;

  const covering = coveringFrom(store, licences);
  const roles = (await readOrganizationRoles(organizationId)) ?? [];
  const pagesOfRole = new Map(
    roles.map((role) => [
      role.roleId,
      [...(role.accessKeys?.lottery?.pages ?? []), ...(role.accessKeys?.electron?.pages ?? [])]
        .filter((page) => page.enabled && LOTTERY_PAGES.has(page.key))
        .map((page) => page.key)
    ])
  );

  // The store's own assignment wins over the organization's, the same rule everywhere else.
  const forStore = new Map<string, Doc>();
  for (const assignment of assignments) {
    const target = text(assignment.storeId);
    if (target && target !== storeId) continue;
    if (text(assignment.workerInstallationId)) continue;
    const appUserId = text(assignment.appUserId);
    const current = forStore.get(appUserId);
    if (!current || (target && !text(current.storeId))) forStore.set(appUserId, assignment);
  }

  const people = (await AppUserModel.find({ appUserId: { $in: [...forStore.keys()] } })
    .select("+passwordHash")
    .lean()) as Doc[];

  const users: Array<{ id: string; email: string; name: string | null; status: string; password_hash: string | null }> = [];
  const access: Array<{ user_id: string; role: string; pages: string[] }> = [];
  const revoked: string[] = [];

  for (const person of people) {
    const appUserId = text(person.appUserId);
    const assignment = forStore.get(appUserId);
    const pages = pagesOfRole.get(text(assignment?.role)) ?? [];
    const live = text(person.status) === "active" && text(assignment?.status || "active") === "active";

    // A role with no lottery page gives nobody anything to do in this app, which is correct: the
    // control plane decides who may close a shift, not the PC.
    if (!live || pages.length === 0) {
      revoked.push(appUserId);
      continue;
    }
    users.push({
      id: appUserId,
      email: text(person.email).toLowerCase(),
      name: person.name ? text(person.name) : null,
      status: text(person.status),
      password_hash: typeof person.passwordHash === "string" && person.passwordHash ? person.passwordHash : null
    });
    access.push({ user_id: appUserId, role: text(assignment?.role), pages });
  }

  const settings = (store.settings as Doc | undefined) ?? {};
  const lottery = (settings.lottery as Doc | undefined) ?? {};
  // One switch: selling lottery is running our lottery app (D-24).
  const sellsLottery = ((settings.capabilities as Doc | undefined) ?? {}).lottery === true;

  return {
    version: typeof store.projectionVersion === "number" ? store.projectionVersion : 1,
    organization: {
      id: organizationId,
      name: text(organization.name),
      slug: text(organization.slug),
      status: text(organization.status)
    },
    store: {
      id: storeId,
      organization_id: organizationId,
      name: text(store.name),
      store_number: store.storeNumber ? text(store.storeNumber) : null,
      time_zone: settings.timeZone ? text(settings.timeZone) : null,
      state_code: settings.stateCode ? text(settings.stateCode) : "GA",
      status: text(store.status),
      cloud_mode: lottery.cloudMode === "local" ? "local" : "cloud"
    },
    licence: {
      status: covering && isEntitled(covering) ? text(covering.status) : covering ? text(covering.status) : "none",
      expires_at: covering ? iso(covering.entitlementExpiresAt) : null,
      number: covering ? text(covering.licenseNumber) : null,
      scope: covering ? text(covering.scope) : null,
      offline_grace_days: covering && typeof covering.offlineGraceDays === "number" ? covering.offlineGraceDays : 7
    },
    config: [
      { key: "lottery.appEnabled", value: sellsLottery },
      ...(lottery.rackLayout ? [{ key: "rack.layout", value: lottery.rackLayout }] : []),
      ...(lottery.settings ? [{ key: "lottery.settings", value: lottery.settings }] : [])
    ],
    users,
    access,
    device: installation
      ? {
          id: text(installation.workerInstallationId),
          credential_hash: null,
          status: text(installation.status),
          device_name: installation.workerName ? text(installation.workerName) : null
        }
      : null,
    revoked
  };
}

/**
 * Anything a projection must never carry, named rather than implied. A test looks for each of these
 * in a built projection, because the day one of them appears is the day a lottery PC is handed the
 * key to a store's register or its public hostname.
 */
export const forbiddenInProjection = [
  "cloudflareToken",
  "tunnelUrl",
  "tunnelId",
  "relayKey",
  "posPasswordCipher",
  "secretHash",
  "sealedSecret",
  "serviceRole",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;
