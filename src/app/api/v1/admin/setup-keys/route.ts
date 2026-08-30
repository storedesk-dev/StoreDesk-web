import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { TenantStoreModel, WorkerInstallationModel, SetupKeyModel } from "@/models/ControlPlane";
import { issueSetupKey, hashSecret, publicId } from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/control-plane";
import { z } from "zod";

const generateKeySchema = z.object({
  organizationId: z.string(),
  storeId: z.string()
});

export async function POST(req: Request) {
  try {
    const admin = await requireInternalAdmin(req);
    await connectDb();
    
    const body = await req.json();
    const result = generateKeySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
    }

    const { organizationId, storeId } = result.data;

    // 1. Enforce Config Gate
    const store = await TenantStoreModel.findOne({ organizationId, storeId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    
    if (!store.tunnelUrl) {
      return NextResponse.json({ error: "Cannot generate setup key: Store Tunnel URL is missing." }, { status: 428 });
    }

    // 2. Find or Create Worker Installation
    let installation = await WorkerInstallationModel.findOne({
      organizationId,
      storeId,
      status: { $in: ["awaiting_activation", "active"] }
    });

    if (!installation) {
      // Auto-create installation for this store
      const workerInstallationId = publicId("winst");
      installation = await WorkerInstallationModel.create({
        organizationId,
        storeId,
        subscriptionId: store.subscriptionId,
        workerInstallationId,
        workerName: "Primary Edge Server",
        contactEmail: store.contactEmail || "admin@storedesk.net",
        status: "awaiting_activation"
      });
    }

    // 3. Revoke any pending keys
    await SetupKeyModel.updateMany(
      {
        workerInstallationId: installation.workerInstallationId,
        status: { $in: ["queued", "sent", "delivery_failed"] }
      },
      { status: "revoked", revokedAt: new Date() }
    );

    // 4. Generate New Key
    const issued = issueSetupKey();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const record = await SetupKeyModel.create({
      organizationId,
      storeId,
      workerInstallationId: installation.workerInstallationId,
      subscriptionId: installation.subscriptionId,
      keyId: issued.keyId,
      secretHash: await hashSecret(issued.secret),
      contactEmail: installation.contactEmail,
      status: "sent", // Bypassing email for UI display
      expiresAt,
      deliveryReason: "admin_ui_generation",
      idempotencyKey: publicId("idem"),
      createdByAdminId: admin.adminId
    });

    await writeAudit({
      organizationId,
      storeId,
      workerInstallationId: installation.workerInstallationId,
      actorType: "internal_admin",
      actorId: admin.adminId,
      action: "setup_key.ui_issue",
      targetType: "setup_key",
      targetId: issued.keyId,
      metadata: { status: record.status }
    });

    return NextResponse.json({
      setupKey: issued.plaintext,
      expiresAt: record.expiresAt,
      workerInstallationId: installation.workerInstallationId
    });

  } catch (error: unknown) {
    console.error("Generate Setup Key Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
