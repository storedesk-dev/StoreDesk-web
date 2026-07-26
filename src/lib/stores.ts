import { randomBytes } from "crypto";

export type StoreStatus = "active" | "suspended";
export type LicensePlan = "trial" | "standard" | "custom";

export type StoreRecord = {
  _id: string;
  name: string;
  storeId: string;
  agentKey: string;
  status: StoreStatus;
  entitlements: string[];
  licensePlan: LicensePlan;
  supportEndsAt: string;
  supportConfirmedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateStoreInput = {
  name: string;
  notes?: string;
  licensePlan: LicensePlan;
  supportEndsAt: string;
  supportConfirmed: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

export function newStoreId(): string {
  return `SD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function newAgentKey(): string {
  return `sk_${randomBytes(24).toString("hex")}`;
}

/** Default support end: trial 30d, standard 365d, custom requires explicit date. */
export function defaultSupportEndsAt(plan: LicensePlan, customIso?: string): string {
  if (plan === "custom") {
    if (!customIso) throw new Error("custom plan requires supportEndsAt");
    return new Date(customIso).toISOString();
  }
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  d.setUTCDate(d.getUTCDate() + (plan === "trial" ? 30 : 365));
  return d.toISOString();
}

export function createStoreFields(input: CreateStoreInput): Omit<StoreRecord, "_id"> {
  if (!input.supportConfirmed) {
    throw new Error("support period must be double-confirmed");
  }
  const supportEndsAt = defaultSupportEndsAt(
    input.licensePlan,
    input.licensePlan === "custom" ? input.supportEndsAt : input.supportEndsAt || undefined
  );
  // For trial/standard, prefer computed default unless client sent a date
  const ends =
    input.licensePlan === "custom"
      ? supportEndsAt
      : input.supportEndsAt
        ? new Date(input.supportEndsAt).toISOString()
        : supportEndsAt;

  const ts = nowIso();
  return {
    name: input.name.trim(),
    storeId: newStoreId(),
    agentKey: newAgentKey(),
    status: "active",
    entitlements: ["desktop", "mobile", "edge"],
    licensePlan: input.licensePlan,
    supportEndsAt: ends,
    supportConfirmedAt: ts,
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts
  };
}

export function toStoreRecord(doc: {
  _id: { toString(): string };
  name: string;
  storeId: string;
  agentKey: string;
  status: string;
  entitlements?: string[];
  licensePlan?: string;
  supportEndsAt?: Date | string;
  supportConfirmedAt?: Date | string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): StoreRecord {
  const ends =
    doc.supportEndsAt instanceof Date
      ? doc.supportEndsAt.toISOString()
      : doc.supportEndsAt || defaultSupportEndsAt((doc.licensePlan as LicensePlan) || "trial");

  return {
    _id: doc._id.toString(),
    name: doc.name,
    storeId: doc.storeId,
    agentKey: doc.agentKey,
    status: doc.status as StoreStatus,
    entitlements: doc.entitlements ?? [],
    licensePlan: (doc.licensePlan as LicensePlan) || "trial",
    supportEndsAt: ends,
    supportConfirmedAt: doc.supportConfirmedAt
      ? doc.supportConfirmedAt instanceof Date
        ? doc.supportConfirmedAt.toISOString()
        : String(doc.supportConfirmedAt)
      : undefined,
    notes: doc.notes ?? undefined,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString()
  };
}

const g = globalThis as unknown as { __sdStores?: StoreRecord[] };

function bag(): StoreRecord[] {
  if (!g.__sdStores) g.__sdStores = [];
  return g.__sdStores;
}

export const memoryStore = {
  list(): StoreRecord[] {
    return [...bag()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  get(id: string): StoreRecord | undefined {
    return bag().find((s) => s._id === id);
  },
  create(input: CreateStoreInput): StoreRecord {
    const row: StoreRecord = { _id: randomBytes(12).toString("hex"), ...createStoreFields(input) };
    bag().push(row);
    return row;
  },
  update(
    id: string,
    patch: Partial<
      Pick<StoreRecord, "name" | "notes" | "status" | "entitlements" | "agentKey" | "licensePlan" | "supportEndsAt">
    >
  ): StoreRecord | undefined {
    const row = bag().find((s) => s._id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updatedAt: nowIso() });
    return row;
  }
};
