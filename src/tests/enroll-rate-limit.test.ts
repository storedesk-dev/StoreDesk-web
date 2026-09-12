import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/app-auth/enroll/route";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";

/**
 * Enrollment is public and verifies a secret, so it is rate-limited per
 * caller and per account. Every request here is refused (short password)
 * before enrollAppUser runs, so no database is needed.
 */

const ACCOUNT = "appu_0123456789abcdef0123456789abcdef";

function enroll(caller: string, account = ACCOUNT) {
  return POST(
    new Request("http://localhost/api/v1/app-auth/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": caller },
      body: JSON.stringify({
        enrollmentCredential: `${account}.secret`,
        password: "short",
        deviceName: "Set up on the web",
        audience: "desktop"
      })
    })
  );
}

beforeEach(() => resetRateLimitsForTests());

describe("POST /api/v1/app-auth/enroll rate limits", () => {
  it("limits one caller to 30 attempts in 15 minutes, across accounts", async () => {
    for (let i = 0; i < 30; i += 1) {
      const account = `appu_${i.toString(16).padStart(32, "0")}`;
      expect((await enroll("203.0.113.7", account)).status).toBe(400);
    }
    const refused = await enroll("203.0.113.7", "appu_ffffffffffffffffffffffffffffffff");
    expect(refused.status).toBe(429);
    expect((await refused.json()).error.code).toBe("ENROLL_RATE_LIMITED");
    // Another caller is unaffected.
    expect((await enroll("198.51.100.9", "appu_ffffffffffffffffffffffffffffffff")).status).toBe(400);
  });

  it("limits one account to 10 attempts in 15 minutes, across callers", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await enroll(`198.51.100.${i}`)).status).toBe(400);
    }
    const refused = await enroll("198.51.100.200");
    expect(refused.status).toBe(429);
    expect((await refused.json()).error.code).toBe("ENROLL_RATE_LIMITED");
    // Another account is unaffected.
    expect((await enroll("198.51.100.200", "appu_ffffffffffffffffffffffffffffffff")).status).toBe(400);
  });
});
