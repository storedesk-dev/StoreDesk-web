import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { memoryStore, newAgentKey, toStoreRecord } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const agentKey = newAgentKey();

  if (!hasMongoUri()) {
    const store = memoryStore.update(id, { agentKey });
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ source: "memory", store });
  }

  await connectDb();
  const doc = await StoreModel.findByIdAndUpdate(id, { agentKey }, { new: true });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ source: "atlas", store: toStoreRecord(doc) });
}
