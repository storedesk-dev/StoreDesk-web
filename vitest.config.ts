import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Route tests start one in-memory MongoDB replica set per file
    // (src/tests/helpers/mongo.ts); argon2 hashing is deliberately slow.
    testTimeout: 30_000,
    hookTimeout: 180_000,
    maxWorkers: 4
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
