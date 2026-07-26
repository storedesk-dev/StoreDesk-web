import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { memoryStore, toStoreRecord } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: "active" | "suspended" };
  const status = body.status === "active" ? "active" : "suspended";

  if (!hasMongoUri()) {
    const store = memoryStore.update(id, { status });
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ source: "memory", store });
  }

  await connectDb();
  const doc = await StoreModel.findByIdAndUpdate(id, { status }, { new: true });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ source: "atlas", store: toStoreRecord(doc) });
}
