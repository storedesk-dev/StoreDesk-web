import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/app-auth/organizations/[slug]/route";
import { POST as login } from "@/app/api/v1/app-auth/login/route";
import { normalizeOrganizationSlug } from "@/lib/control-plane";
import { resetRateLimitsForTests } from "@/lib/control-plane-security";

/**
 * Sign-in starts with the organization: the app looks up its name, then signs
 * in to it. Every case here returns before the database is touched.
 */

function lookup(slug: string, caller = "203.0.113.7") {
  return GET(
    new Request(`http://localhost/api/v1/app-auth/organizations/${encodeURIComponent(slug)}`, {
      headers: { "x-forwarded-for": caller }
    }),
    { params: Promise.resolve({ slug }) }
  );
}

describe("organization slugs", () => {
  it("normalizes case and spaces around the slug", () => {
    expect(normalizeOrganizationSlug("  Patel-Retail ")).toBe("patel-retail");
    expect(normalizeOrganizationSlug("org_0123abc")).toBe("org_0123abc");
  });

  it("refuses anything that is not a slug", () => {
    expect(normalizeOrganizationSlug("")).toBeNull();
    expect(normalizeOrganizationSlug("-patel")).toBeNull();
    expect(normalizeOrganizationSlug("patel retail")).toBeNull();
    expect(normalizeOrganizationSlug("patel/../admin")).toBeNull();
    expect(normalizeOrganizationSlug("a".repeat(101))).toBeNull();
  });
});

describe("GET /api/v1/app-auth/organizations/{slug}", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("answers 400 for a malformed slug", async () => {
    const res = await lookup("patel retail");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("REQUEST_INVALID");
  });

  it("rate-limits one caller after 30 lookups a minute", async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await lookup("not a slug")).status).toBe(400);
    }
    expect((await lookup("not a slug")).status).toBe(429);
    // Another caller is unaffected.
    expect((await lookup("not a slug", "198.51.100.9")).status).toBe(400);
  });
});

describe("POST /api/v1/app-auth/login with an organization", () => {
  it("refuses an organizationSlug that is not a string", async () => {
    const res = await login(
      new Request("http://localhost/api/v1/app-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "owner@example.invalid",
          password: "a-long-password",
          audience: "mobile",
          organizationSlug: { $ne: "" }
        })
      })
    );
    expect(res.status).toBe(400);
  });
});
