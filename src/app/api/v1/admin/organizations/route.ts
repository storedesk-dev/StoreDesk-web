import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createOrganization, jsonError, provisionAppUser } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { ControlPlaneError, safeJson } from "@/lib/control-plane-security";
import { OrganizationModel, TenantStoreModel } from "@/models/ControlPlane";

export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    await connectDb();
    const rows = await OrganizationModel.find({}).sort({ createdAt: -1 }).lean();
    
    // Fetch stores count for each org
    const orgIds = rows.map(r => r.organizationId);
    const stores = await TenantStoreModel.find({ organizationId: { $in: orgIds } }).lean();
    
    for (const org of rows) {
      (org as Record<string, unknown>).stores = stores.filter(s => s.organizationId === org.organizationId);
    }
    return NextResponse.json({ organizations: safeJson(rows) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    const body = (await req.json()) as { name?: string; slug?: string; billingEmail?: string; ownerEmail?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    
    await connectDb();
    
    const organization = await createOrganization(admin, {
      name: body.name,
      slug: body.slug,
      billingEmail: body.billingEmail
    });

    // The optional owner goes through the canonical AppUser path.
    //
    // This block used to hand-roll the user with an `apu_` id — but
    // `enrollAppUser` only accepts `appu_`, so the owner's enrollment always
    // failed. It also returned a *worker* setup key rather than an enrollment
    // credential, and created an assignment with no store or installation,
    // which `issueClientSession` can never resolve into a session. The owner is
    // now created properly and assigned to stores once those stores exist.
    let enrollmentCredential: string | null = null;
    let ownerNotice: string | null = null;

    if (body.ownerEmail?.trim()) {
      try {
        const owner = await provisionAppUser(admin, { email: body.ownerEmail });
        enrollmentCredential = owner.enrollmentCredential;
      } catch (error) {
        if (error instanceof ControlPlaneError && error.code === "RESOURCE_EXISTS") {
          ownerNotice = "That email already has a StoreDesk account. Assign it to this organization's stores from the Users tab.";
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({ organization, enrollmentCredential, ownerNotice }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
