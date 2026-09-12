import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

/** Admin API calls without a session cookie get the standard error shape; pages redirect to sign-in. */

describe("middleware", () => {
  it("answers an admin API call without a cookie with 401 UNAUTHORIZED", async () => {
    const res = await middleware(new NextRequest("http://localhost/api/v1/admin/dashboard"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Sign in again." } });
  });

  it("lets a call with a session-shaped cookie through to the route, which checks it", async () => {
    const res = await middleware(
      new NextRequest("http://localhost/api/v1/admin/dashboard", { headers: { cookie: "sd_session=ses_abc.secret" } })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends an admin page without a cookie to the sign-in gate", async () => {
    const res = await middleware(new NextRequest("http://localhost/admin/organizations"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/admin-gate?next=%2Fadmin%2Forganizations");
  });
});
