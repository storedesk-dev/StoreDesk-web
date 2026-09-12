/**
 * `npm run dev:local` — the control plane against a throwaway database.
 *
 * Starts an in-memory MongoDB replica set, seeds sample data (src/lib/dev-seed.ts),
 * prints the logins, then runs `next dev` with that MONGODB_URI. Everything is
 * gone when you stop it (Ctrl+C).
 *
 * .env.local is still read by Next, but the variables below are blanked here
 * first so a local run can never create a real Cloudflare tunnel, send a real
 * e-mail or sign in with the production bootstrap admin (Next does not
 * override a variable that is already set). To keep one, set
 * DEV_LOCAL_KEEP=CLOUDFLARE_API_TOKEN,RESEND_API_KEY,…
 *
 * Optional env: DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, DEV_USER_PASSWORD, PORT.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { DEV_LOCAL_BLANKED_ENV } from "../src/lib/dev-local-env";

const BLANKED: readonly string[] = DEV_LOCAL_BLANKED_ENV;

async function main() {
  const keep = new Set((process.env.DEV_LOCAL_KEEP ?? "").split(",").map((key) => key.trim()).filter(Boolean));
  for (const key of BLANKED) if (!keep.has(key)) process.env[key] = "";
  process.env.STORE_SECRET_KEY ||= randomBytes(32).toString("base64url");

  console.log("[dev:local] starting an in-memory MongoDB replica set…");
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const uri = replSet.getUri("storedesk_dev");
  process.env.MONGODB_URI = uri;

  const { seedDevData } = await import("../src/lib/dev-seed");
  const mongoose = (await import("mongoose")).default;
  const seed = await seedDevData({
    adminEmail: process.env.DEV_ADMIN_EMAIL,
    adminPassword: process.env.DEV_ADMIN_PASSWORD,
    userPassword: process.env.DEV_USER_PASSWORD
  });
  await mongoose.disconnect();

  const port = process.env.PORT || "3000";
  const lines = [
    "",
    "──────────────────────── StoreDesk control plane (local) ────────────────────────",
    `  Admin console   http://localhost:${port}/admin`,
    `  Staff sign-in   ${seed.admin.email}  /  ${seed.admin.password}`,
    "",
    `  Organization    ${seed.organization.name}   org tag: ${seed.organization.slug}`,
    ...seed.stores.map((store) => `  Store           ${store.name}   features: ${store.features}`),
    "",
    "  App users (sign in at a store server, not here):",
    ...seed.users.map((user) =>
      user.kind === "managed"
        ? `    ${user.email.padEnd(30)} ${user.role} @ ${user.where}   password: ${user.password}`
        : `    ${user.email.padEnd(30)} ${user.role} @ ${user.where}   invitation code (paste at /enroll):\n      ${user.invitationCode}`
    ),
    ...(seed.setupKey
      ? ["", `  Setup key for ${seed.setupKey.store} (expires ${seed.setupKey.expiresAt}):`, `    ${seed.setupKey.key}`]
      : []),
    "",
    `  MongoDB         ${uri}  (in memory; gone on exit)`,
    "  Cloudflare and e-mail are off: stores show the tunnel as not configured.",
    "──────────────────────────────────────────────────────────────────────────────────",
    ""
  ];
  console.log(lines.join("\n"));

  const child = spawn("npx", ["next", "dev", "--turbopack", "-p", port], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
  });

  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    if (!child.killed) child.kill();
    await replSet.stop().catch(() => undefined);
    process.exit(code);
  };
  child.on("exit", (code) => void stop(code ?? 0));
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
}

main().catch((error) => {
  console.error("[dev:local] failed:", error);
  process.exit(1);
});
