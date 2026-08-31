import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { AppUserModel, UserAssignmentModel } from "@/models/ControlPlane";
import { safeJson, issueSetupKey, hashSecret, publicId } from "@/lib/control-plane-security";
import { z } from "zod";

type Ctx = { params: Promise<{ organizationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    await connectDb();

    // Get all assignments for this org
    const assignments = await UserAssignmentModel.find({ organizationId, status: "active" }).lean();
    const appUserIds = [...new Set(assignments.map(a => a.appUserId))];

    // Hydrate users
    const users = await AppUserModel.find({ appUserId: { $in: appUserIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Join assignment data
    const result = users.map(u => ({
      ...safeJson(u),
      assignments: assignments.filter(a => String(a.appUserId) === String(u.appUserId))
    }));

    return NextResponse.json({ appUsers: result });
  } catch (error) {
    return jsonError(error);
  }
}

const CreateAppUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
  storeId: z.string().optional()
});

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId } = await ctx.params;
    const body = await req.json();
    const parsed = CreateAppUserSchema.parse(body);

    await connectDb();

    // 1. Find or Create the AppUser
    let appUser = await AppUserModel.findOne({ email: parsed.email.toLowerCase() });
    
    let setupKeyPlaintext = null;
    if (!appUser) {
      // Issue a setup key for enrollment
      const setupKey = issueSetupKey();
      const secretHash = await hashSecret(setupKey.secret);
      
      appUser = await AppUserModel.create({
        appUserId: publicId("apu"),
        email: parsed.email.toLowerCase(),
        name: parsed.name,
        status: "pending_enrollment",
        enrollmentSecretHash: secretHash,
        enrollmentExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdByAdminId: admin.adminId
      });
      setupKeyPlaintext = setupKey.plaintext;
    } else {
      // Optionally update name if missing
      if (parsed.name && !appUser.name) {
        appUser.name = parsed.name;
        await appUser.save();
      }
    }

    // 2. Determine Role — First user in organization MUST be org_admin
    const existingCount = await UserAssignmentModel.countDocuments({ organizationId, status: "active" });
    const assignedRole = (existingCount === 0) ? "org_admin" : (parsed.role || "store_operator");

    const assignment = await UserAssignmentModel.create({
      assignmentId: publicId("asn"),
      appUserId: appUser.appUserId,
      organizationId,
      storeId: parsed.storeId,
      role: assignedRole,
      status: "active",
      createdByAdminId: admin.adminId
    });

    return NextResponse.json({ 
      appUser: safeJson(appUser), 
      assignment: safeJson(assignment),
      setupKey: setupKeyPlaintext 
    });
  } catch (error) {
    return jsonError(error);
  }
}
