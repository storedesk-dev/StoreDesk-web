import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { SetupKeyModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";

type Ctx = {
  params: Promise<{
    organizationId: string;
    storeId: string;
    workerInstallationId: string;
    keyId: string;
  }>;
};

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId, workerInstallationId, keyId } = await ctx.params;
    await connectDb();
    const key = await SetupKeyModel.findOne({
      organizationId,
      storeId,
      workerInstallationId,
      keyId
    }).lean();
    if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      setupKey: safeJson({
        keyId: key.keyId,
        status: key.status,
        expiresAt: key.expiresAt,
        contactEmail: key.contactEmail,
        deliveryProvider: key.deliveryProvider,
        deliveryMessageId: key.deliveryMessageId
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId, workerInstallationId, keyId } = await ctx.params;
    await connectDb();
    const updated = await SetupKeyModel.findOneAndUpdate(
      {
        organizationId,
        storeId,
        workerInstallationId,
        keyId,
        status: { $in: ["queued", "sent", "delivery_failed"] }
      },
      { status: "revoked", revokedAt: new Date() },
      { new: true }
    ).lean();
    if (!updated) return NextResponse.json({ error: "Not found or already final" }, { status: 404 });
    return NextResponse.json({
      setupKey: safeJson({ keyId: updated.keyId, status: updated.status })
    });
  } catch (error) {
    return jsonError(error);
  }
}
