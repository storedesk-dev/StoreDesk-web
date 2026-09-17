import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setupKeyEmailText } from "@/lib/email-provider";

/**
 * Claims the site makes about the product, checked against the product.
 *
 * `lib/site.ts` puts it best: marketing copy that drifts from what ships is worse than no copy. The
 * one that actually went wrong was register writes — five pages said StoreDesk "never writes to the
 * register" and "only needs permission to view", long after Settings › Register writes shipped with
 * Off / Test / On and batches of up to 50 items. A store reading that would grant the wrong Commander
 * permissions and be surprised by its own software.
 */

/**
 * The pages and components a visitor actually reads. `src/lib` is left out on purpose: it is control
 * plane code, where "worker credential" and "worker installation" are the right words (CLAUDE.md) —
 * the marketing facts it does hold live in site.ts, which is listed explicitly.
 */
const PUBLIC_DIRS = ["src/app", "src/components"];
const EXTRA_FILES = ["src/lib/site.ts"];
/** The control plane's own screens and the API, which no customer reads. */
const NOT_MARKETING = ["src/app/admin", "src/app/admin-gate", "src/app/api"];

function walk(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir)).flatMap((name) => {
    const full = join(dir, name);
    if (NOT_MARKETING.some((skip) => full.startsWith(skip))) return [];
    if (statSync(join(process.cwd(), full)).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const pages = [...PUBLIC_DIRS.flatMap((dir) => walk(dir)), ...EXTRA_FILES];
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("what the site claims about the register", () => {
  it("never says StoreDesk cannot write to it", () => {
    // It can: Settings › Register writes, Off by default, Test and On send staged changes.
    for (const file of pages) {
      expect(read(file), `${file} claims StoreDesk never writes to the register`).not.toMatch(/never writes?\b/i);
    }
  });

  it("never tells a store that a view-only Commander login is enough", () => {
    for (const file of pages) {
      expect(read(file), `${file} says the register login only needs to view`).not.toMatch(/only needs permission to view/i);
    }
  });

  it("says writes are off until you turn them on, and that a person sends them", () => {
    const product = read("src/app/product/ProductClient.tsx");
    expect(product).toMatch(/off until you turn it on/i);
    expect(product).toMatch(/confirmed by a person/i);
  });
});

/** Strips comments, so a note to a developer is not mistaken for something a visitor reads. */
function rendered(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("what the public pages give away", () => {
  // These pages are indexed. A privacy policy has to say what is held and who can see it; naming the
  // file path, the hashing algorithm or the transport adds nothing for a reader and is free
  // reconnaissance for anyone else.
  const INTERNALS = [
    /%?ProgramData/i,
    /argon2/i,
    /\bloopback\b/i,
    /\b127\.0\.0\.1\b/,
    /\bDPAPI\b/i,
    /\bSQLite\b/i,
    /\bcloudflared\b/i,
    /sealed config/i,
    /relay key/i,
    /password hash/i
  ];

  it("name no internals a reader cannot act on", () => {
    for (const file of pages) {
      const text = rendered(file);
      for (const pattern of INTERNALS) {
        expect(text, `${file} exposes ${pattern} to a visitor`).not.toMatch(pattern);
      }
    }
  });
});

describe("what the site calls things", () => {
  it("never shows a customer the repo names", () => {
    // brand-kit/README.md: StoreDesk Desktop, StoreDesk Mobile, StoreDesk Service. "Worker" and
    // "Server" are repo names, and only survive as control-plane terms on the admin screens.
    for (const file of pages) {
      const text = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(text, `${file} shows a customer the word "Worker"`).not.toMatch(/\bWorker\b(?!s?["'`]|Id|Credential)/);
    }
  });
});

describe("what the site says about the setup key", () => {
  // 0.0.9: a redeem consumes the key and mints the next one in the same transaction
  // (lib/store-setup-key.ts). Copy that told the owner to keep the key and use it again sent them
  // back to a key that had already stopped working.
  it("never tells the owner to keep the key and use it again", () => {
    for (const file of [...pages, "src/lib/email-provider.ts"]) {
      const text = rendered(file);
      expect(text, `${file} tells the owner to keep the setup key`).not.toMatch(/Keep the key/i);
      expect(text, `${file} says the setup key can be used again`).not.toMatch(/\bUse it again\b/i);
    }
  });

  it("says the key works until it is used and that StoreDesk makes the next one", () => {
    const email = setupKeyEmailText({
      to: "owner@example.com",
      recipientName: "Sam",
      organizationName: "Org",
      storeName: "Store",
      setupKey: "SD-TEST",
      expiresAt: null
    });
    expect(email).toMatch(/works until it is used/i);
    expect(email).toMatch(/makes a new one/i);
    expect(email).toMatch(/organization admin/i);
  });
});
