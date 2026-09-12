import { describe, expect, it, vi } from "vitest";

/**
 * The control plane's old client sign-in is turned off: 410 GONE, and no work
 * — the body is never read, no database, no password check, no session.
 */

vi.mock("@/lib/db", () => ({
  connectDb: vi.fn(async () => null),
  hasMongoUri: () => false,
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  withSession: () => ({})
}));

vi.mock("@/lib/control-plane-security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/control-plane-security")>()),
  verifySecret: vi.fn(async () => true),
  signClientSession: vi.fn()
}));

import { POST as appAuthLogin } from "@/app/api/v1/app-auth/login/route";
import { POST as appAuthSessions } from "@/app/api/v1/app-auth/sessions/route";
import { POST as convenienceLogin } from "@/app/api/auth/login/route";
import { connectDb } from "@/lib/db";
import { signClientSession, verifySecret } from "@/lib/control-plane-security";

const GONE = {
  error: { code: "GONE", message: "Sign in at your store: the app does this for you." }
};

describe.each([
  ["POST /api/v1/app-auth/login", appAuthLogin, "/api/v1/app-auth/login"],
  ["POST /api/v1/app-auth/sessions", appAuthSessions, "/api/v1/app-auth/sessions"],
  ["POST /api/auth/login", convenienceLogin, "/api/auth/login"]
])("%s", (_name, handler, path) => {
  it("answers 410 GONE and does no work", async () => {
    const req = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@example.invalid",
        password: "a-long-password",
        audience: "mobile",
        appUserId: "appu_1",
        deviceId: "dev_1",
        assignmentId: "asg_1"
      })
    });
    const res = await (handler as (req: Request) => Promise<Response>)(req);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual(GONE);
    expect(req.bodyUsed).toBe(false);
    expect(connectDb).not.toHaveBeenCalled();
    expect(verifySecret).not.toHaveBeenCalled();
    expect(signClientSession).not.toHaveBeenCalled();
  });
});
