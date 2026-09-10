import { describe, expect, it } from "vitest";
import { toDnsLabel } from "@/lib/control-plane";

/**
 * Guards for store provisioning.
 *
 * A store's phone-app address is `<label>.<tunnel domain>`. With the slug left
 * blank, createStore used to fall back to the generated `store_<hex>` id, whose
 * underscore is not allowed in a hostname — so the tunnel's DNS record failed.
 */

const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

describe("toDnsLabel", () => {
  it("strips the underscore from a generated store id", () => {
    const label = toDnsLabel("store_0f1e2d3c4b5a69788796a5b4c3d2e1f0");
    expect(label).not.toContain("_");
    expect(label).toMatch(DNS_LABEL);
  });

  it("turns a store name into a readable label", () => {
    expect(toDnsLabel("Hop In #42 — Midtown")).toBe("hop-in-42-midtown");
  });

  it("drops accents rather than producing an invalid label", () => {
    expect(toDnsLabel("Café Exprés")).toBe("cafe-expres");
  });

  it("never starts or ends with a hyphen", () => {
    expect(toDnsLabel("--Corner Market--")).toBe("corner-market");
  });

  it("caps at 63 characters without leaving a trailing hyphen", () => {
    const label = toDnsLabel(`${"a".repeat(62)} b`);
    expect(label.length).toBeLessThanOrEqual(63);
    expect(label).toMatch(DNS_LABEL);
  });

  it("returns empty for input with nothing usable, so a fallback is taken", () => {
    expect(toDnsLabel("!!!")).toBe("");
    expect(toDnsLabel("")).toBe("");
  });
});
