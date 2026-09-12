import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { dashboard } from "@/lib/admin-views";

/** Counts, needs-attention items and recent activity across every organization. */
export async function GET(req: Request) {
  try {
    await requireInternalAdmin(req);
    return NextResponse.json(await dashboard());
  } catch (error) {
    return jsonError(error);
  }
}
