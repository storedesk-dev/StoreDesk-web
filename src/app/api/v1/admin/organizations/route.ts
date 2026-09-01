import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { createOrganization, jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { safeJson, issueSetupKey, hashSecret, publicId } from "@/lib/control-plane-security";
import { AppUserModel, UserAssignmentModel, OrganizationModel, TenantStoreModel } from "@/models/ControlPlane";

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

    let setupKeyPlaintext = null;

    if (body.ownerEmail?.trim()) {
      const email = body.ownerEmail.trim().toLowerCase();
      let appUser = await AppUserModel.findOne({ email });

      if (!appUser) {
        const setupKey = issueSetupKey();
        const secretHash = await hashSecret(setupKey.secret);
        
        appUser = await AppUserModel.create({
          appUserId: publicId("apu"),
          email,
          status: "pending_enrollment",
          enrollmentSecretHash: secretHash,
          enrollmentExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          createdByAdminId: admin.adminId
        });
        setupKeyPlaintext = setupKey.plaintext;
      }

      await UserAssignmentModel.create({
        assignmentId: publicId("asn"),
        appUserId: appUser.appUserId,
        organizationId: organization.organizationId,
        role: "org_admin", // Organization Owner role
        status: "active",
        createdByAdminId: admin.adminId
      });
    }

    return NextResponse.json({ organization, setupKey: setupKeyPlaintext }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
