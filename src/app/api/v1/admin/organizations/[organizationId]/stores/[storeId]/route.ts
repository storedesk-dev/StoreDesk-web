import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";
import { scheduleNotify } from "@/lib/store-notify";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    await connectDb();
    
    const store = await TenantStoreModel.findOne({ organizationId, storeId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    
    return NextResponse.json({ store: safeJson(store) });
  } catch (error) {
    return jsonError(error);
  }
}

import { z } from "zod";

const ConfigSchema = z.object({
  posIntegration: z.string().optional(),
  posIpAddress: z.string().optional(),
  posUsername: z.string().optional(),
  posPassword: z.string().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional()
}).catchall(z.any());

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const body = await req.json();
    
    await connectDb();
    const store = await TenantStoreModel.findOne({ organizationId, storeId });
    
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (body.name !== undefined) store.name = body.name;
    if (body.storeNumber !== undefined) store.storeNumber = body.storeNumber;
    if (body.address !== undefined) store.address = body.address;
    if (body.contactEmail !== undefined) store.contactEmail = body.contactEmail;
    if (body.status !== undefined) store.status = body.status;
    if (body.tunnelUrl !== undefined) store.tunnelUrl = body.tunnelUrl;
    if (body.configJson !== undefined) {
      if (body.configJson.trim()) {
        try {
          const parsed = JSON.parse(body.configJson);
          ConfigSchema.parse(parsed);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Invalid configuration";
          return NextResponse.json({ error: `Invalid configuration: ${msg}` }, { status: 400 });
        }
      }
      store.configJson = body.configJson;
    }

    await store.save();
    // Name, number, status and tunnel URL are part of the store's access sync.
    scheduleNotify({ organizationId, storeId, reason: "store.update" });

    return NextResponse.json({ store: safeJson(store) });
  } catch (error) {
    return jsonError(error);
  }
}

import { WorkerInstallationModel, SetupKeyModel } from "@/models/ControlPlane";
import { deleteCloudflareTunnel } from "@/lib/cloudflare";

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    
    await connectDb();
    
    const store = await TenantStoreModel.findOne({ organizationId, storeId });
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (store.tunnelUrl) {
      try {
        const urlObj = new URL(store.tunnelUrl);
        const tunnelSlug = urlObj.hostname.split('.')[0];
        if (tunnelSlug) {
          await deleteCloudflareTunnel(tunnelSlug);
        }
      } catch (err) {
        console.warn("[delete store] Failed to delete tunnel gracefully:", err);
      }
    }

    await TenantStoreModel.deleteOne({ organizationId, storeId });
    await WorkerInstallationModel.deleteMany({ organizationId, storeId });
    await SetupKeyModel.deleteMany({ organizationId, storeId });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
