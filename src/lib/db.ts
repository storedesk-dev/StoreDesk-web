import mongoose, { type ClientSession } from "mongoose";

const globalForMongoose = globalThis as unknown as {
  mongoosePromise?: Promise<typeof mongoose>;
};

export function hasMongoUri(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function connectDb(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;

  if (!globalForMongoose.mongoosePromise) {
    globalForMongoose.mongoosePromise = mongoose.connect(uri);
  }
  return globalForMongoose.mongoosePromise;
}

/**
 * Multi-document transactions need a replica set. Atlas provides one on every
 * tier including M0, but a standalone `mongod` used for local development does
 * not — so a failure to start a session degrades to "no session" rather than
 * taking the whole control plane down. Callers pass the result through
 * `withSession()`, which is a no-op when the session is null.
 */
export async function startTransaction(): Promise<ClientSession | null> {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  } catch {
    console.warn(
      "[db] Transactions unavailable (standalone mongod?). Falling back to unbatched writes."
    );
    return null;
  }
}

export async function commitTransaction(session: ClientSession | null): Promise<void> {
  if (!session) return;
  await session.commitTransaction();
  await session.endSession();
}

export async function abortTransaction(session: ClientSession | null): Promise<void> {
  if (!session) return;
  try {
    await session.abortTransaction();
  } finally {
    await session.endSession();
  }
}

/** Spread into a Mongoose call to scope it to `session`, or to nothing. */
export function withSession(session: ClientSession | null): { session?: ClientSession } {
  return session ? { session } : {};
}
