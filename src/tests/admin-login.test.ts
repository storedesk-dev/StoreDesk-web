import { beforeEach, describe, expect, it } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { ADMIN_PASSWORD, call, createAdmin, lastAudit, request } from "./helpers/api";
import { DELETE as logout, GET as whoAmI, POST as login } from "@/app/api/admin/login/route";
import { AuditEventModel } from "@/models/ControlPlane";

/** Staff sign-in (P7): per-address and per-e-mail lockout, standard errors, audit. */

setupMemoryMongo();

const EMAIL = "admin@example.invalid";

function attempt(password: string, ip = "203.0.113.7", email = EMAIL) {
  return call(login, request("POST", "/api/admin/login", { body: { email, password }, headers: { "x-forwarded-for": ip } }));
}

beforeEach(async () => {
  await createAdmin(EMAIL);
});

describe("POST /api/admin/login", () => {
  it("signs in, sets the session cookie and audits admin.login", async () => {
    const res = await attempt(ADMIN_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, admin: { email: EMAIL } });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^sd_session=ses_[a-f0-9]{32}\./);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(await lastAudit("admin.login")).toBeTruthy();

    const token = cookie.split(";")[0].split("=").slice(1).join("=");
    const me = await call(whoAmI, request("GET", "/api/admin/login", { headers: { cookie: `sd_session=${token}` } }));
    expect(me.status).toBe(200);
    expect(me.body.admin.email).toBe(EMAIL);
  });

  it("answers 401 LOGIN_INVALID for a wrong password and audits it without the password", async () => {
    const res = await attempt("not the password");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("LOGIN_INVALID");
    const audit = await lastAudit("admin.login_failed");
    expect(audit?.metadata).toMatchObject({ email: EMAIL });
    expect(JSON.stringify(audit)).not.toContain("not the password");
    expect(JSON.stringify(audit)).not.toContain("203.0.113.7");
  });

  it("answers 401 for an unknown e-mail, the same way", async () => {
    const res = await attempt(ADMIN_PASSWORD, "203.0.113.7", "nobody@example.invalid");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("LOGIN_INVALID");
  });

  it("answers 400 REQUEST_INVALID without an e-mail or password", async () => {
    const res = await call(login, request("POST", "/api/admin/login", { body: { email: EMAIL } }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("REQUEST_INVALID");
  });

  it("locks one e-mail after 5 failures, from any address, even with the right password", async () => {
    for (let i = 0; i < 5; i += 1) expect((await attempt("wrong", `198.51.100.${i}`)).status).toBe(401);
    const locked = await attempt(ADMIN_PASSWORD, "198.51.100.99");
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("LOGIN_RATE_LIMITED");
  });

  it("locks one address after 10 failures across e-mails; another address is unaffected", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await attempt("wrong", "203.0.113.50", `user${i}@example.invalid`)).status).toBe(401);
    }
    expect((await attempt(ADMIN_PASSWORD, "203.0.113.50")).status).toBe(429);
    expect((await attempt(ADMIN_PASSWORD, "203.0.113.51")).status).toBe(200);
  });

  it("clears the e-mail's count on a success", async () => {
    for (let i = 0; i < 4; i += 1) await attempt("wrong", `192.0.2.${i}`);
    expect((await attempt(ADMIN_PASSWORD, "192.0.2.10")).status).toBe(200);
    for (let i = 0; i < 4; i += 1) await attempt("wrong", `192.0.2.${20 + i}`);
    expect((await attempt(ADMIN_PASSWORD, "192.0.2.30")).status).toBe(200);
    expect(await AuditEventModel.countDocuments({ action: "admin.login_failed" })).toBe(8);
  });
});

describe("GET and DELETE /api/admin/login", () => {
  it("answers 401 without a session", async () => {
    const res = await call(whoAmI, request("GET", "/api/admin/login"));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("signing out revokes the session", async () => {
    const admin = await createAdmin("second@example.invalid");
    expect((await call(whoAmI, request("GET", "/", { token: admin.token }))).status).toBe(200);
    const out = await call(logout, request("DELETE", "/api/admin/login", { token: admin.token }));
    expect(out.status).toBe(200);
    expect((await call(whoAmI, request("GET", "/", { token: admin.token }))).status).toBe(401);
  });
});
