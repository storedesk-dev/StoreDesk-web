import { describe, expect, it } from "vitest";
import { GET as accessSync } from "@/app/api/v1/edge/sync/access/route";
import { PUT as updateRole } from "@/app/api/v1/edge/roles/[roleId]/route";

/**
 * Both edge routes answer only to a worker credential. These return before the
 * database is touched.
 */

describe("edge access routes without a worker credential", () => {
  it("refuses the access pull", async () => {
    const res = await accessSync(new Request("http://localhost/api/v1/edge/sync/access"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("WORKER_CREDENTIAL_INVALID");
  });

  it("refuses a role update, even with a client session token", async () => {
    const res = await updateRole(
      new Request("http://localhost/api/v1/edge/roles/org_admin", {
        method: "PUT",
        headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig", "Content-Type": "application/json" },
        body: JSON.stringify({ baseVersion: 1, roleName: "x", accessKeys: {} })
      }),
      { params: Promise.resolve({ roleId: "org_admin" }) }
    );
    expect(res.status).toBe(401);
  });
});
