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
 * internal admin, one organization with an organization license, four
 * stores showing every way a store is licensed — two on the organization
 * license (one with fuel and lottery, one without), one with its own trial
 * license, one unlicensed — the four template roles, and users of both kinds.
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
  organization: { organizationId: string; name: string; slug: string };
  stores: Array<{ storeId: string; name: string; features: string; license: string }>;
  users: Array<{ email: string; kind: "managed" | "invite"; role: string; where: string; password?: string; invitationCode?: string }>;
  setupKey: { store: string; key: string; expiresAt: string } | null;
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

  const { organization, license } = await createOrganization(admin, {
    name: "Example Retail",
    slug: "example-retail",
    billingEmail: "billing@example-retail.test",
    license: { plan: "standard", maxStores: 5, maxPcsPerStore: 1, offlineGraceDays: 7 }
  });
  const organizationId = organization.organizationId;
  const orgNumber = license!.licenseNumber;

  const { store: main } = await createStore(admin, organizationId, {
    name: "Store 42 · Main St",
    storeNumber: "42",
    address: "42 Main St, Atlanta, GA 30303",
    contactEmail: "store42@example-retail.test",
    timeZone: "America/New_York",
    license: { mode: "organization" }
  });
  await updateStoreSettings(
    admin,
    organizationId,
    main.storeId,
    {
      capabilities: { fuel: true, lottery: true, coam: false },
      integrations: {
        googleSheets: {
          enabled: false,
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1ExampleSheetIdForLocalRuns000000000/edit",
          sheetName: "Daily",
          headerRow: 1
        }
      }
    },
    main.settingsVersion
  );
  const { store: elm } = await createStore(admin, organizationId, {
    name: "Store 17 · Elm Ave",
    storeNumber: "17",
    address: "17 Elm Ave, Decatur, GA 30030",
    contactEmail: "store17@example-retail.test",
    timeZone: "America/New_York",
    license: { mode: "organization" }
  });
  const { store: hwy } = await createStore(admin, organizationId, {
    name: "Store 88 · Hwy 9",
    storeNumber: "88",
    address: "8800 Hwy 9, Alpharetta, GA 30004",
    timeZone: "America/New_York",
    license: { mode: "store", newLicense: { plan: "trial", entitlementDays: 30 } }
  });
  const { store: pine } = await createStore(admin, organizationId, {
    name: "Store 90 · Pine Rd",
    storeNumber: "90",
    address: "90 Pine Rd, Marietta, GA 30060",
    timeZone: "America/New_York",
    license: { mode: "none" }
  });
  const hwyNumber = hwy.license?.licenseNumber ?? "";

  const owner = "owner@example-retail.test";
  const manager = "rakesh@storedesk.com";
  const cashier = "cashier@example-retail.test";
  await addUser(admin, organizationId, {
    mode: "managed",
    email: owner,
    name: "Priya (owner)",
    password: userPassword,
    assignments: [{ storeId: null, role: "org_admin" }]
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
  const key = await issueStoreSetupKey(admin, organizationId, main.storeId, { deliver: "show" });

  return {
    admin: { email: adminEmail, password: adminPassword },
    organization: { organizationId, name: organization.name, slug: organization.slug },
    stores: [
      { storeId: main.storeId, name: main.name, features: "fuel, lottery", license: `organization license ${orgNumber}` },
      { storeId: elm.storeId, name: elm.name, features: "none", license: `organization license ${orgNumber}` },
      { storeId: hwy.storeId, name: hwy.name, features: "none", license: `own trial license ${hwyNumber}` },
      { storeId: pine.storeId, name: pine.name, features: "none", license: "unlicensed" }
    ],
    users: [
      { email: owner, kind: "managed", role: "Organization Admin", where: "every store", password: userPassword },
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
