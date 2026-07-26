import { Schema, models, model, type InferSchemaType } from "mongoose";

const StoreSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    storeId: { type: String, required: true, unique: true, index: true },
    agentKey: { type: String, required: true },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    entitlements: { type: [String], default: ["desktop", "mobile", "edge"] },
    licensePlan: { type: String, enum: ["trial", "standard", "custom"], default: "trial" },
    supportEndsAt: { type: Date, required: true },
    supportConfirmedAt: { type: Date },
    notes: { type: String }
  },
  { timestamps: true }
);

export type StoreDoc = InferSchemaType<typeof StoreSchema> & { _id: { toString(): string } };

export const StoreModel = models.Store || model("Store", StoreSchema);
