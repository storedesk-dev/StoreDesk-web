import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import {
  AppUserModel,
  UserAssignmentModel,
  TenantStoreModel,
  OrganizationModel,
  WorkerInstallationModel
} from "@/models/ControlPlane";
import { verifySecret, signRelaySession } from "@/lib/control-plane-security";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      assignmentId?: string;
      audience?: "desktop" | "mobile";
    };

    if (!body.email || !body.password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }

    await connectDb();

    // Find the app user and select passwordHash
    const user = await AppUserModel.findOne({
      email: body.email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify password using bcrypt or fall back to verifySecret (argon2)
    const hash = String(user.passwordHash);
    let isValid = false;

    if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
      // bcrypt hash
      isValid = await bcrypt.compare(body.password, hash);
    } else {
      // argon2 hash (existing/legacy users)
      isValid = await verifySecret(hash, body.password);
    }

    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.status !== "active") {
      return NextResponse.json({ error: "App user is not active" }, { status: 403 });
    }

    // Find active assignments
    const assignments = await UserAssignmentModel.find({
      appUserId: user.appUserId,
      status: "active"
    }).lean();

    if (assignments.length === 0) {
      return NextResponse.json({ error: "No assignments found for this app user" }, { status: 403 });
    }

    // Find the selected assignment, or default to the first one
    let assignment = assignments[0];
    if (body.assignmentId) {
      const matched = assignments.find((a) => a.assignmentId === body.assignmentId);
      if (matched) {
        assignment = matched;
      }
    }

    // Load organization, store and installation details
    const [org, store, installation] = await Promise.all([
      OrganizationModel.findOne({ organizationId: assignment.organizationId }).lean(),
      TenantStoreModel.findOne({ storeId: assignment.storeId }).lean(),
      WorkerInstallationModel.findOne({ workerInstallationId: assignment.workerInstallationId }).lean()
    ]);

    // Sign JWT session token
    const relay = signRelaySession({
      sub: user.appUserId,
      storeId: String(assignment.storeId),
      installationId: String(assignment.workerInstallationId),
      role: "client",
      scopes: (assignment.scopes as string[]) || ["relay:request"],
      organizationId: String(assignment.organizationId),
      assignmentId: String(assignment.assignmentId),
      audience: body.audience || "desktop"
    });

    return NextResponse.json({
      token: relay.token,
      expiresAt: relay.expiresAt.toISOString(),
      organization: {
        organizationId: assignment.organizationId,
        name: org?.name || "Store Owner"
      },
      tunnelUrl: (store as any)?.tunnelUrl || null,
      lanUrl: (installation as any)?.lanUrl || null,
      assignmentId: assignment.assignmentId
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
