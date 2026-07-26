import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { memoryStore, type StoreRecord } from "@/lib/stores";
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
  return NextResponse.json({ source: "atlas", store: toClient(doc) });
}
