import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { createStoreFields, memoryStore, type StoreRecord } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

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

export async function GET() {
  if (!hasMongoUri()) {
    return NextResponse.json({ source: "memory", stores: memoryStore.list() });
  }
  await connectDb();
  const docs = await StoreModel.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    source: "atlas",
    stores: docs.map((d) => toClient(d as never))
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; notes?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!hasMongoUri()) {
    const store = memoryStore.create(body.name, body.notes);
    return NextResponse.json({ source: "memory", store }, { status: 201 });
  }

  await connectDb();
  const fields = createStoreFields(body.name, body.notes);
  const doc = await StoreModel.create(fields);
  return NextResponse.json({ source: "atlas", store: toClient(doc) }, { status: 201 });
}
