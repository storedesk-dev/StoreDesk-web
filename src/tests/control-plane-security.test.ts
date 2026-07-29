import { describe, expect, it } from "vitest";
import {
  AtomicSingleUseGrant,
  ControlPlaneError,
  issueSetupKey,
  parseSetupKey,
  safeJson
} from "@/lib/control-plane-security";

describe("control-plane-security", () => {
  it("issues and parses setup keys without embedding permanent credentials", () => {
    const issued = issueSetupKey();
    expect(issued.plaintext.startsWith("set_")).toBe(true);
    expect(issued.plaintext).toContain(".");
    const parsed = parseSetupKey(issued.plaintext);
    expect(parsed.keyId).toBe(issued.keyId);
    expect(parsed.secret).toBe(issued.secret);
  });

  it("redacts secret-like fields from list projections", () => {
    const redacted = safeJson({
      keyId: "set_abc",
      status: "sent",
      secretHash: "SHOULD_NOT_LEAK",
      passwordHash: "SHOULD_NOT_LEAK",
      workerCredential: "SHOULD_NOT_LEAK",
      nested: { setupKey: "SHOULD_NOT_LEAK", contactEmail: "site@example.invalid" }
    });
    expect(redacted).toEqual({
      keyId: "set_abc",
      status: "sent",
      nested: { contactEmail: "site@example.invalid" }
    });
  });

  it("enforces single-use grant semantics", async () => {
    const grant = new AtomicSingleUseGrant(Date.now() + 60_000);
    const first = await grant.redeem(async () => "ok");
    expect(first).toBe("ok");
    await expect(grant.redeem(async () => "again")).rejects.toBeInstanceOf(ControlPlaneError);
  });
});
