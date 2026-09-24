import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Nothing that runs on the server may import a module marked `"use client"`.
 *
 * This exists because the whole suite went green and production still broke. Vitest runs in Node,
 * where `"use client"` is just a string at the top of a file, so importing a client module from a
 * server module is invisible to every unit test — and then Next answers, at runtime, in production,
 * on a real request:
 *
 *   Attempted to call linkWithCode() from the server but linkWithCode is on the client.
 *
 * Which `jsonError` cannot identify, so the caller is told "Control plane temporarily unavailable"
 * and nobody can tell what happened without reading the log. That was a password reset for every
 * real account: the route returned early for an unknown address, so it only failed for people who
 * actually had one.
 *
 * A static read of the imports catches it in a second, which is the point.
 */

const SRC = join(process.cwd(), "src");

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const isClientModule = (file: string): boolean => {
  const head = readFileSync(file, "utf8").slice(0, 200);
  return /^\s*["']use client["']/.test(head);
};

/** `@/lib/x` and `./x` → the file it resolves to, or null when it is a package. */
function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? join(from, "..", spec)
      : null;
  if (!base) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

describe("the server never imports client-only code", () => {
  it("holds across every module under src/lib and every route handler", () => {
    const serverFiles = filesUnder(SRC).filter(
      (file) =>
        !isClientModule(file) &&
        !file.includes(`${join("src", "tests")}`) &&
        (file.includes(`${join("src", "lib")}`) || /route\.tsx?$/.test(file))
    );

    const offences: string[] = [];
    for (const file of serverFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
        const target = resolveLocal(file, match[1]!);
        if (target && isClientModule(target)) {
          offences.push(`${file.replace(SRC, "src")} imports client module ${target.replace(SRC, "src")}`);
        }
      }
    }

    expect(offences, offences.join("\n")).toEqual([]);
  });
});
