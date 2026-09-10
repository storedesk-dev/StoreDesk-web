import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/app-auth/enroll/route";

/**
 * The enroll route is public — it has to be, the person calling it has no
 * account yet. So the password rule cannot live only in the /enroll form:
 * enrollAppUser hashes whatever it is given, and a direct request would
 * otherwise set a one-character password.
 *
 * Both cases here return before enrollAppUser runs, so no database is needed.
 */

function enroll(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/v1/app-auth/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

const valid = {
  enrollmentCredential: "appu_0123456789abcdef0123456789abcdef.secret",
  deviceName: "Set up on the web",
  audience: "desktop"
};

describe("POST /api/v1/app-auth/enroll", () => {
  it("rejects a password shorter than eight characters", async () => {
    const res = await enroll({ ...valid, password: "short" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("rejects a request missing a required field", async () => {
    const res = await enroll({ ...valid, password: "" });
    expect(res.status).toBe(400);
    const body = await res.json();
    // A structured error the /enroll form can map to a message — it used to
    // be a bare string, unlike every other error from this API.
    expect(body.error.code).toBe("REQUEST_INVALID");
  });
});
