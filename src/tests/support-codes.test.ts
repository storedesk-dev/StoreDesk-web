import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupMemoryMongo } from "./helpers/mongo";
import { activatePc, call, createAdmin, lastAudit, request, seedOrganization, type TestAdmin } from "./helpers/api";
import { GET as listRoute, POST as issueRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/support-codes/route";
import { DELETE as revokeRoute } from "@/app/api/v1/admin/organizations/[organizationId]/stores/[storeId]/support-codes/[supportCodeId]/route";
import { POST as redeemRoute } from "@/app/api/v1/edge/support-codes/redeem/route";
import { resetRateLimitsForTests, sha256 } from "@/lib/control-plane-security";
import { normalizeSupportCode } from "@/lib/support-codes";
import { createStore } from "@/lib/tenant-stores";
import { AuditEventModel, SupportCodeModel } from "@/models/ControlPlane";

vi.mock("@/lib/store-notify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store-notify")>()),
  scheduleNotify: vi.fn(),
  scheduleAppUserNotify: vi.fn()
}));
vi.mock("@/lib/cloudflare", () => ({
  provisionCloudflareTunnel: vi.fn(async () => null),
  deleteCloudflareTunnel: vi.fn(async () => true)
}));

/**
 * Support codes: staff issue one for a store (shown once, 30 minutes, single
 * use, hashed); only that store's PC can redeem it; expiry, reuse, other
 * stores, revoke, the per-installation limit, and the audit.
 */

setupMemoryMongo();

const CODE = /^sup_[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;
let admin: TestAdmin;
let seeded: Awaited<ReturnType<typeof seedOrganization>>;
let params: { organizationId: string; storeId: string };

beforeEach(async () => {
  vi.clearAllMocks();
  resetRateLimitsForTests();
  admin = await createAdmin();
  seeded = await seedOrganization(admin);
  params = { organizationId: seeded.organization.organizationId, storeId: seeded.store.storeId };
});

const issue = (target = params) => call(issueRoute, request("POST", "/", { token: admin.token }), target);
const list = () => call(listRoute, request("GET", "/", { token: admin.token }), params);
const revoke = (supportCodeId: string) => call(revokeRoute, request("DELETE", "/", { token: admin.token }), { ...params, supportCodeId });
const redeem = (token: string, code: unknown) =>
  call(redeemRoute, request("POST", "/api/v1/edge/support-codes/redeem", { body: { code }, headers: { Authorization: `Bearer ${token}` } }));

describe("codes as typed", () => {
  it.each([
    ["sup_ABCDE-FGHJK", "ABCDEFGHJK"],
    ["  sup_abcde fghjk ", "ABCDEFGHJK"],
    ["SUPABCDEFGHJK", "ABCDEFGHJK"],
    ["abcde-fghjk", "ABCDEFGHJK"],
    ["sup_0O1IL-23456", "0011123456"],
    ["sup_ABCDE", null],
    ["sup_ABCDE-FGHJU", null],
    ["hello", null]
  ])("%j → %j", (typed, expected) => {
    expect(normalizeSupportCode(typed)).toBe(expected);
  });
});

describe("issuing", () => {
  it("shows the code once, binds it to the store for 30 minutes, keeps only its SHA-256, and audits who issued it", async () => {
    const res = await issue();
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.body.code).toMatch(CODE);
    expect(res.body.supportCode).toMatchObject({ status: "active", issuedBy: "Test Admin", usedAt: null, revokedAt: null });
    const ttl = new Date(res.body.supportCode.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000);

    const body = normalizeSupportCode(res.body.code)!;
    const stored = await SupportCodeModel.findOne({}).select("+codeHash").lean();
    expect(stored).toMatchObject({ storeId: params.storeId, organizationId: params.organizationId, codeHash: sha256(`support:${body}`) });
    expect(JSON.stringify(stored)).not.toContain(body);

    const audit = await lastAudit("support_code.issue");
    expect(audit).toMatchObject({ actorType: "internal_admin", actorId: admin.adminId, storeId: params.storeId, targetType: "support_code" });
    expect(JSON.stringify(audit)).not.toContain(body);

    const listed = await list();
    expect(listed.body.supportCodes).toEqual([expect.objectContaining({ status: "active", issuedBy: "Test Admin" })]);
    expect(JSON.stringify(listed.body)).not.toContain(body);
    expect(JSON.stringify(listed.body)).not.toContain("codeHash");
  });

  it("answers 401 without a staff session and 404 for another organization's store", async () => {
    expect((await call(issueRoute, request("POST", "/"), params)).status).toBe(401);
    expect((await issue({ organizationId: "org_nope", storeId: params.storeId })).status).toBe(404);
  });
});

describe("redeeming on the store PC", () => {
  it("works once: 200 {ok, expiresAt, issuedBy}, then 409 SUPPORT_CODE_USED; both audited", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const { body } = await issue();
    const ok = await redeem(pc.token, body.code.toLowerCase().replace("-", " "));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true, expiresAt: body.supportCode.expiresAt, issuedBy: "Test Admin" });
    expect(await lastAudit("support_code.redeem")).toMatchObject({
      actorType: "worker",
      actorId: pc.workerInstallationId,
      targetId: body.supportCode.supportCodeId,
      metadata: { result: "ok" }
    });

    const again = await redeem(pc.token, body.code);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("SUPPORT_CODE_USED");
    expect((await lastAudit("support_code.redeem"))?.metadata).toEqual({ result: "used" });
    expect((await list()).body.supportCodes[0]).toMatchObject({ status: "used", usedAt: expect.any(String) });
  });

  it("an expired code: 410 SUPPORT_CODE_EXPIRED, shown expired, can't be revoked", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const { body } = await issue();
    await SupportCodeModel.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1_000) } });
    const res = await redeem(pc.token, body.code);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("SUPPORT_CODE_EXPIRED");
    expect((await lastAudit("support_code.redeem"))?.metadata).toEqual({ result: "expired" });
    expect((await list()).body.supportCodes[0].status).toBe("expired");
    expect((await revoke(body.supportCode.supportCodeId)).status).toBe(409);
  });

  it("another store's code, or an unknown one, is 404 SUPPORT_CODE_INVALID with the same message; the code stays usable", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const { store: sibling } = await createStore(admin, params.organizationId, { name: "Store 17" });
    const siblingPc = await activatePc(params.organizationId, sibling.storeId);
    const other = await seedOrganization(admin, { slug: "other-retail", name: "Other Retail" });
    const otherPc = await activatePc(other.organization.organizationId, other.store.storeId);
    const { body } = await issue();

    const unknown = await redeem(siblingPc.token, "sup_00000-00000");
    for (const res of [await redeem(siblingPc.token, body.code), await redeem(otherPc.token, body.code), unknown, await redeem(siblingPc.token, "hello")]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: "SUPPORT_CODE_INVALID", message: unknown.body.error.message });
    }
    const invalid = await AuditEventModel.find({ action: "support_code.redeem" }).lean();
    expect(invalid).toHaveLength(4);
    expect(invalid.every((event) => event.targetId === "unknown" && (event.metadata as { result: string }).result === "invalid")).toBe(true);

    expect((await redeem(pc.token, body.code)).status).toBe(200);
  });

  it("a revoked code can't be redeemed; revoke is audited and only for an active code", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    const { body } = await issue();
    const revoked = await revoke(body.supportCode.supportCodeId);
    expect(revoked.status).toBe(200);
    expect(revoked.body.supportCode).toMatchObject({ status: "revoked", revokedAt: expect.any(String) });
    expect(await lastAudit("support_code.revoke")).toMatchObject({ actorId: admin.adminId, targetId: body.supportCode.supportCodeId });

    const res = await redeem(pc.token, body.code);
    expect(res.status).toBe(410);
    expect((await lastAudit("support_code.redeem"))?.metadata).toEqual({ result: "revoked" });
    const twice = await revoke(body.supportCode.supportCodeId);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe("SUPPORT_CODE_NOT_ACTIVE");
    expect((await revoke("supc_nope")).status).toBe(404);
  });

  it("limits one installation to 10 attempts in 15 minutes; others are unaffected", async () => {
    const pc = await activatePc(params.organizationId, params.storeId);
    for (let i = 0; i < 10; i += 1) expect((await redeem(pc.token, "sup_00000-00000")).status).toBe(404);
    const limited = await redeem(pc.token, "sup_00000-00000");
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("SUPPORT_CODE_RATE_LIMITED");
    const secondPc = await activatePc(params.organizationId, params.storeId);
    expect((await redeem(secondPc.token, "sup_00000-00000")).status).toBe(404);
  });

  it("needs the worker credential", async () => {
    const res = await call(redeemRoute, request("POST", "/api/v1/edge/support-codes/redeem", { body: { code: "sup_00000-00000" } }));
    expect(res.status).toBe(401);
  });
});
