import { describe, expect, it } from "vitest";
import {
  CONTROL_PLANE_ISSUER,
  issueRelayKey,
  issueWorkerCredential,
  safeJson,
  signClientSession
} from "@/lib/control-plane-security";

/**
 * Guards for the three field-name mismatches that made worker activation fail
 * end to end, plus the secret-scrubbing rule.
 */

describe("worker credential", () => {
  it("mints an id the worker authenticator will accept", () => {
    const credential = issueWorkerCredential();
    // `authenticateWorker()` requires the `wcred_` prefix. Minting `wkrc_`
    // meant a credential could never authenticate even when it existed.
    expect(credential.credentialId.startsWith("wcred_")).toBe(true);
    expect(credential.plaintext).toBe(`${credential.credentialId}.${credential.secret}`);
  });
});

describe("client session signing", () => {
  const relayKey = issueRelayKey();
  const claims = {
    sub: "appu_1",
    organizationId: "org_1",
    storeId: "store_1",
    workerInstallationId: "winst_1",
    assignmentId: "assign_1",
    audience: "desktop" as const,
    role: "org_admin",
    scopes: ["relay:request"]
  };

  it("signs with the installation's relay key and pins the tenant chain", () => {
    const { token } = signClientSession(relayKey, claims);
    const [, payload] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    expect(decoded.iss).toBe(CONTROL_PLANE_ISSUER);
    expect(decoded.aud).toBe("storedesk-worker");
    // The Worker compares these against its own sealed identity, so a token for
    // one store cannot be replayed against another.
    expect(decoded.organizationId).toBe("org_1");
    expect(decoded.storeId).toBe("store_1");
    expect(decoded.workerInstallationId).toBe("winst_1");
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it("refuses to sign without a usable relay key", () => {
    // A worker with no active credential has no key; minting an unverifiable
    // token would 403 on every subsequent request instead of failing here.
    expect(() => signClientSession("", claims)).toThrow(/relay/i);
  });
});

describe("safeJson", () => {
  it("scrubs the tunnel token and relay key like any other secret", () => {
    const scrubbed = safeJson({
      storeId: "store_1",
      cloudflareToken: "eyJhIjoiVE9LRU4ifQ==",
      relayKey: "SECRET",
      secretHash: "hash",
      passwordHash: "hash",
      name: "Corner Market"
    });

    // The tunnel token was previously whitelisted past the scrubber so the
    // admin UI could display it inline. It now has a dedicated audited endpoint.
    expect(scrubbed).not.toHaveProperty("cloudflareToken");
    expect(scrubbed).not.toHaveProperty("relayKey");
    expect(scrubbed).not.toHaveProperty("secretHash");
    expect(scrubbed).not.toHaveProperty("passwordHash");
    expect(scrubbed.name).toBe("Corner Market");
  });
});
