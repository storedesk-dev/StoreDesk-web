import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectDb } from "@/lib/db";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";
import "@/models/ControlPlane";

/**
 * One in-memory MongoDB replica set per test file (transactions need a
 * replica set). Sets MONGODB_URI, builds every model's indexes so unique
 * constraints hold, and empties every collection and the rate limiters after
 * each test. Call at the top level of a test file.
 */
export function setupMemoryMongo(): void {
  let replSet: MongoMemoryReplSet | null = null;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    process.env.MONGODB_URI = replSet.getUri("storedesk_test");
    (globalThis as { mongoosePromise?: unknown }).mongoosePromise = undefined;
    await connectDb();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  }, 180_000);

  afterEach(async () => {
    resetRateLimitsForTests();
    const db = mongoose.connection.db;
    if (!db) return;
    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    (globalThis as { mongoosePromise?: unknown }).mongoosePromise = undefined;
    await replSet?.stop();
  }, 60_000);
}
