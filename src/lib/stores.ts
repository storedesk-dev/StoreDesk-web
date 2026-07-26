import { randomBytes } from "crypto";

export type StoreStatus = "active" | "suspended";

export type StoreRecord = {
  _id: string;
  name: string;
  storeId: string;
  agentKey: string;
  status: StoreStatus;
  entitlements: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

export function createStoreFields(name: string, notes?: string): Omit<StoreRecord, "_id"> {
  const ts = nowIso();
  return {
    name: name.trim(),
    storeId: newStoreId(),
    agentKey: newAgentKey(),
    status: "active",
    entitlements: ["desktop", "mobile", "edge"],
    notes: notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts
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
  create(name: string, notes?: string): StoreRecord {
    const row: StoreRecord = { _id: randomBytes(12).toString("hex"), ...createStoreFields(name, notes) };
    bag().push(row);
    return row;
  },
  update(id: string, patch: Partial<Pick<StoreRecord, "name" | "notes" | "status" | "entitlements" | "agentKey">>): StoreRecord | undefined {
    const row = bag().find((s) => s._id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updatedAt: nowIso() });
    return row;
  }
};
