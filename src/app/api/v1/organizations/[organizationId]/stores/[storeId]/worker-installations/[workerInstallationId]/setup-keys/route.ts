import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { issueSetupKeyEmail, jsonError } from "@/lib/control-plane";

type Ctx = {
  params: Promise<{ organizationId: string; storeId: string; workerInstallationId: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId, workerInstallationId } = await ctx.params;
    const body = (await req.json()) as { deliveryReason?: string; idempotencyKey?: string };
    if (!body.deliveryReason?.trim() || !body.idempotencyKey?.trim()) {
      return NextResponse.json(
        { error: "deliveryReason and idempotencyKey are required" },
        { status: 400 }
      );
    }
    const setupKey = await issueSetupKeyEmail(admin, organizationId, storeId, workerInstallationId, {
      deliveryReason: body.deliveryReason,
      idempotencyKey: body.idempotencyKey
    });
    return NextResponse.json({ setupKey }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
