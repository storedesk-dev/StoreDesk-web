import { NextResponse } from "next/server";
import { connectDb, hasMongoUri } from "@/lib/db";
import { createStoreFields, memoryStore, toStoreRecord, type CreateStoreInput, type LicensePlan } from "@/lib/stores";
import { StoreModel } from "@/models/Store";

export async function GET() {
  if (!hasMongoUri()) {
    return NextResponse.json({ source: "memory", stores: memoryStore.list() });
  }
  await connectDb();
  const docs = await StoreModel.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    source: "atlas",
    stores: docs.map((d) => toStoreRecord(d as never))
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CreateStoreInput> & {
    confirmPhrase?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const plan = (body.licensePlan || "trial") as LicensePlan;
  if (!["trial", "standard", "custom"].includes(plan)) {
    return NextResponse.json({ error: "invalid licensePlan" }, { status: 400 });
  }

  if (!body.supportConfirmed) {
    return NextResponse.json({ error: "supportConfirmed must be true (double confirm)" }, { status: 400 });
  }

  if (body.confirmPhrase !== "CONFIRM") {
    return NextResponse.json({ error: 'Type CONFIRM to issue the license' }, { status: 400 });
  }

  if (!body.supportEndsAt) {
    return NextResponse.json({ error: "supportEndsAt is required" }, { status: 400 });
  }

  const input: CreateStoreInput = {
    name: body.name,
    notes: body.notes,
    licensePlan: plan,
    supportEndsAt: body.supportEndsAt,
    supportConfirmed: true
  };

  try {
    if (!hasMongoUri()) {
      const store = memoryStore.create(input);
      return NextResponse.json({ source: "memory", store }, { status: 201 });
    }

    await connectDb();
    const fields = createStoreFields(input);
    const doc = await StoreModel.create({
      ...fields,
      supportEndsAt: new Date(fields.supportEndsAt),
      supportConfirmedAt: fields.supportConfirmedAt ? new Date(fields.supportConfirmedAt) : undefined
    });
    return NextResponse.json({ source: "atlas", store: toStoreRecord(doc) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
