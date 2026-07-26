import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { memoryStore, toStoreRecord } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!hasMongoUri()) {
    const store = memoryStore.get(id);
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ source: "memory", store });
  }
  await connectDb();
  const doc = await StoreModel.findById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ source: "atlas", store: toStoreRecord(doc) });
}
