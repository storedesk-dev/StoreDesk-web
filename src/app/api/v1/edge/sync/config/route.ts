import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";
import { safeJson } from "@/lib/control-plane-security";
import { z } from "zod";

const ConfigSchema = z.object({
  posIntegration: z.literal("verifone_commander"),
  posIpAddress: z.string().optional(),
  posUsername: z.string().optional(),
  posPassword: z.string().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional()
}).strict();

export async function PUT(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const body = await req.json();

    // Validate incoming config from edge
    ConfigSchema.parse(body);

    await connectDb();
    
    // Find the store the worker belongs to
    const store = await TenantStoreModel.findOne({ 
      organizationId: worker.organizationId, 
      storeId: worker.storeId 
    });
    
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Merge the edge payload into the configJson
    let currentConfig = {};
    if (store.configJson && store.configJson.trim()) {
      try {
        currentConfig = JSON.parse(store.configJson);
      } catch {
        // If unparseable, start fresh
      }
    }

    const updatedConfig = {
      ...currentConfig,
      ...body
    };

    store.configJson = JSON.stringify(updatedConfig, null, 2);
    await store.save();

    return NextResponse.json({ store: safeJson(store) });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid configuration schema" }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    await connectDb();
    
    const store = await TenantStoreModel.findOne({ 
      organizationId: worker.organizationId, 
      storeId: worker.storeId 
    }).lean();

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { WorkerInstallationModel } = await import("@/models/ControlPlane");
    const installation = await WorkerInstallationModel.findOne({
      organizationId: worker.organizationId,
      storeId: worker.storeId,
      workerInstallationId: worker.workerInstallationId
    }).lean();

    return NextResponse.json({ 
      configJson: store.configJson,
      cloudflareToken: installation?.cloudflareToken,
      tunnelUrl: installation?.tunnelUrl
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
