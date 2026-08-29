import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/control-plane";
import { connectDb } from "@/lib/db";
import { TenantStoreModel } from "@/models/ControlPlane";

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

    if (!store.tunnelUrl) {
      return NextResponse.json({ 
        status: "offline", 
        message: "No tunnel URL configured" 
      });
    }

    // Ping the tunnel's health endpoint with a short timeout
    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 3000);
      
      const res = await fetch(`${store.tunnelUrl}/api/health`, {
        signal: abortController.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeout);

      if (res.ok) {
        return NextResponse.json({
          status: "online",
          statusCode: res.status,
          message: "Tunnel is reachable and healthy"
        });
      } else {
        return NextResponse.json({
          status: "offline",
          statusCode: res.status,
          message: `Tunnel returned status ${res.status}`
        });
      }
    } catch (e) {
      return NextResponse.json({
        status: "offline",
        message: "Tunnel is unreachable or timed out"
      });
    }

  } catch (error) {
    return jsonError(error);
  }
}
