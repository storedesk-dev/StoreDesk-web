import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCS, DOCS_BASE } from "@/lib/site";

/**
 * The marketing site links into the user guide by topic (`/t/<topic>`), which is the stable address:
 * a topic keeps its link when the page it lives on is renamed or moved. That only holds while the
 * topic exists, so every one named here is checked against the guide's own registry.
 */

const REGISTRY = join(process.cwd(), "..", "store-desk-docs", "topics", "topics.json");

/** Every `/t/<topic>` the site links to. */
function linkedTopics(): string[] {
  return Object.entries(DOCS)
    .filter(([key, value]) => key !== "topic" && typeof value === "string" && value.includes("/t/"))
    .map(([, value]) => (value as string).split("/t/")[1]);
}

describe("the links into the user guide", () => {
  it("all point at docs.storedesk.net", () => {
    for (const [key, value] of Object.entries(DOCS)) {
      if (typeof value !== "string") continue;
      // DOCS.home is the bare origin; everything else is a path under it.
      const base = DOCS_BASE.replace(/[.]/g, "\\.");
      expect(value, `DOCS.${key}`).toMatch(new RegExp(`^${base}(/|$)`));
    }
  });

  it("name topics the guide actually has", () => {
    // Skipped when store-desk-docs is not checked out (it is a submodule; a shallow clone may not have it).
    if (!existsSync(REGISTRY)) return;
    const topics = JSON.parse(readFileSync(REGISTRY, "utf8")) as Record<string, string>;
    const linked = linkedTopics();
    expect(linked.length).toBeGreaterThan(0);
    for (const topic of linked) {
      expect(Object.keys(topics), `the guide has no topic "${topic}"`).toContain(topic);
    }
  });

  it("cover the path a new store actually walks", () => {
    // Install, activate, connect the register, then the phones: the download page's three steps and
    // the setup guide behind them.
    for (const topic of ["flow.install", "flow.activate", "flow.connect-register", "flow.mobile"]) {
      expect(linkedTopics()).toContain(topic);
    }
  });
});
