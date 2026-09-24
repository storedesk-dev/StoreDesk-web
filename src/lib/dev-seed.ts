import { connectDb } from "@/lib/db";
import { InternalAdminModel } from "@/models/ControlPlane";
import { hashSecret, publicId, randomSecret } from "@/lib/control-plane-security";
import type { InternalAdminActor } from "@/lib/admin-auth";
import { createOrganization } from "@/lib/organizations";
import { createStore, updateStoreSettings } from "@/lib/tenant-stores";
import { addUser } from "@/lib/users";
import { issueStoreSetupKey } from "@/lib/setup";

/**
 * Sample data for `npm run dev:local` (a throwaway in-memory database): one
 * internal admin and one organization per licensing mode —
 * - Example Retail, on a master license covering Stores 42 (fuel and
 *   lottery, Google Sheets on), 17 and 88, with the four template roles and
 *   users of both kinds;
 * - Corner Mart Group, store-wise: Store 5 with its own license, Store 6
 *   Unlicensed.
 * Built through the same library calls the admin routes use. No tunnel is
 * created unless Cloudflare is configured.
 */

export type SeedOptions = {
  adminEmail?: string;
  adminPassword?: string;
  userPassword?: string;
};

export type SeedResult = {
  admin: { email: string; password: string };
  organizations: Array<{ organizationId: string; name: string; slug: string; licensing: string }>;
  stores: Array<{ storeId: string; organization: string; name: string; features: string; license: string }>;
  users: Array<{ email: string; kind: "managed" | "invite"; role: string; where: string; password?: string; invitationCode?: string }>;
  setupKey: { store: string; key: string; expiresAt: string | null } | null;
};

function readablePassword(): string {
  return randomSecret(12).replace(/[-_]/g, "x").slice(0, 16);
}

export async function seedDevData(options: SeedOptions = {}): Promise<SeedResult> {
  await connectDb();
  const adminEmail = (options.adminEmail || "admin@storedesk.local").trim().toLowerCase();
  const adminPassword = options.adminPassword || readablePassword();
  const userPassword = options.userPassword || readablePassword();

  const adminId = publicId("adm");
  await InternalAdminModel.create({
    adminId,
    email: adminEmail,
    name: "Local Admin",
    passwordHash: await hashSecret(adminPassword),
    status: "active"
  });
  const admin: InternalAdminActor = { adminId, email: adminEmail };

  // ── Example Retail ─────────────────────────────────────────────────────────
  // Every store gets its own licence now (D-22); an organization starts with none.
  const { organization } = await createOrganization(admin, {
    name: "Example Retail",
    slug: "example-retail",
    billingEmail: "billing@example-retail.test"
  });
  const organizationId = organization.organizationId;

  const { store: main } = await createStore(admin, organizationId, {
    name: "Store 42 · Main St",
    storeNumber: "42",
    address: "42 Main St, Atlanta, GA 30303",
    contactEmail: "store42@example-retail.test",
    timeZone: "America/New_York",
    storeLicense: { plan: "standard", entitlementDays: 365, maxPcsPerStore: 1, offlineGraceDays: 7 }
  });
  await updateStoreSettings(
    admin,
    main.storeId,
    {
      capabilities: { fuel: true, lottery: true, coam: false, ebt: true, moneyOrder: true, prepaidGift: false },
      // Switched on; no sheet yet — the store connects it in the desktop app.
      integrations: { googleSheets: { enabled: true } }
    },
    main.settingsVersion
  );
  const { store: elm } = await createStore(admin, organizationId, {
    name: "Store 17 · Elm Ave",
    storeNumber: "17",
    address: "17 Elm Ave, Decatur, GA 30030",
    contactEmail: "store17@example-retail.test",
    timeZone: "America/New_York",
    storeLicense: { plan: "standard", entitlementDays: 365, maxPcsPerStore: 1, offlineGraceDays: 7 }
  });
  const { store: hwy } = await createStore(admin, organizationId, {
    name: "Store 88 · Hwy 9",
    storeNumber: "88",
    address: "8800 Hwy 9, Alpharetta, GA 30004",
    timeZone: "America/New_York",
    storeLicense: { plan: "standard", entitlementDays: 365, maxPcsPerStore: 1, offlineGraceDays: 7 }
  });

  const owner = "owner@example-retail.test";
  const manager = "rakesh@storedesk.com";
  const cashier = "cashier@example-retail.test";
  await addUser(admin, organizationId, {
    mode: "managed",
    email: owner,
    name: "Priya (owner)",
    password: userPassword,
    // A row per store: there is no organization-wide grant any more (D-22).
    assignments: [main, elm, hwy].map((store) => ({ storeId: store.storeId, role: "org_admin" }))
  });
  await addUser(admin, organizationId, {
    mode: "managed",
    email: manager,
    name: "Rakesh",
    password: userPassword,
    assignments: [{ storeId: main.storeId, role: "store_manager" }]
  });
  const invited = await addUser(admin, organizationId, {
    mode: "invite",
    email: cashier,
    name: "Sam",
    assignments: [{ storeId: elm.storeId, role: "cashier" }]
  });

  // A key waiting on Store 42's PC, so the dashboard has something to show.
  const key = await issueStoreSetupKey(admin, main.storeId, { deliver: "show" });

  // ── Corner Mart Group ──────────────────────────────────────────────────────
  const { organization: corner } = await createOrganization(admin, {
    name: "Corner Mart Group",
    slug: "corner-mart",
    billingEmail: "accounts@corner-mart.test"
  });
  const { store: five } = await createStore(admin, corner.organizationId, {
    name: "Store 5 · Oak St",
    storeNumber: "5",
    address: "5 Oak St, Savannah, GA 31401",
    timeZone: "America/New_York",
    storeLicense: { plan: "standard", entitlementDays: 365 }
  });
  const { store: six } = await createStore(admin, corner.organizationId, {
    name: "Store 6 · Bay Rd",
    storeNumber: "6",
    address: "6 Bay Rd, Savannah, GA 31405",
    timeZone: "America/New_York"
  });

  const own = (store: { license?: { licenseNumber: string } | null }) =>
    store.license ? `own license ${store.license.licenseNumber}` : "Unlicensed";
  return {
    admin: { email: adminEmail, password: adminPassword },
    organizations: [
      { organizationId, name: organization.name, slug: organization.slug, licensing: "a license per store" },
      { organizationId: corner.organizationId, name: corner.name, slug: corner.slug, licensing: "a license per store" }
    ],
    stores: [
      { storeId: main.storeId, organization: organization.name, name: main.name, features: "fuel, lottery, Google Sheets", license: own(main) },
      { storeId: elm.storeId, organization: organization.name, name: elm.name, features: "none", license: own(elm) },
      { storeId: hwy.storeId, organization: organization.name, name: hwy.name, features: "none", license: own(hwy) },
      { storeId: five.storeId, organization: corner.name, name: five.name, features: "none", license: own(five) },
      { storeId: six.storeId, organization: corner.name, name: six.name, features: "none", license: own(six) }
    ],
    users: [
      { email: owner, kind: "managed", role: "Organization Admin", where: "every Example Retail store", password: userPassword },
      { email: manager, kind: "managed", role: "Store Manager", where: main.name, password: userPassword },
      {
        email: cashier,
        kind: "invite",
        role: "Cashier",
        where: elm.name,
        invitationCode: invited.invitationCode ?? undefined
      }
    ],
    setupKey: key.setupKey ? { store: main.name, key: key.setupKey, expiresAt: key.expiresAt } : null
  };
}
