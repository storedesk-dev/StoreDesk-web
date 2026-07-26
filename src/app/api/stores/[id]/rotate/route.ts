import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { memoryStore, newAgentKey, type StoreRecord } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

type Ctx = { params: Promise<{ id: string }> };

function toClient(doc: {
  _id: { toString(): string };
  name: string;
  storeId: string;
  agentKey: string;
  status: string;
  entitlements: string[];
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): StoreRecord {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    storeId: doc.storeId,
    agentKey: doc.agentKey,
    status: doc.status as StoreRecord["status"],
    entitlements: doc.entitlements ?? [],
    notes: doc.notes ?? undefined,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString()
  };
}

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
  return NextResponse.json({ source: "atlas", store: toClient(doc) });
}
