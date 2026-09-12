import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { z } from "zod";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";

/**
 * One error shape everywhere, and client mistakes are never 503: a duplicate
 * unique value is 409, a bad cast or schema failure is 400.
 */

async function body(res: Response) {
  return (await res.json()) as { error: { code: string; message: string; retryable: boolean } } & Record<string, unknown>;
}

describe("jsonError", () => {
  it("keeps a ControlPlaneError's status and code, with details beside the error", async () => {
    const res = jsonError(new ControlPlaneError(409, "ROLE_VERSION_CONFLICT", "stale", false, { role: { roleId: "x" } }));
    expect(res.status).toBe(409);
    const json = await body(res);
    expect(json.error).toMatchObject({ code: "ROLE_VERSION_CONFLICT", message: "stale", retryable: false });
    expect(json.role).toEqual({ roleId: "x" });
  });

  it("answers 409 for a Mongo duplicate key", async () => {
    const res = jsonError(Object.assign(new Error("E11000"), { code: 11000, keyValue: { slug: "a" } }));
    expect(res.status).toBe(409);
    expect((await body(res)).error).toMatchObject({ code: "RESOURCE_EXISTS", message: "That slug is already in use" });
  });

  it("answers 400 for a cast error, a validation error and a zod error", async () => {
    const cast = new mongoose.Error.CastError("Number", "abc", "maxStores");
    expect(jsonError(cast).status).toBe(400);
    const validation = new mongoose.Error.ValidationError();
    validation.addError("name", new mongoose.Error.ValidatorError({ message: "name is required", path: "name" }));
    expect(jsonError(validation).status).toBe(400);
    const zod = z.object({ a: z.string() }).safeParse({});
    const res = jsonError(zod.error);
    expect(res.status).toBe(400);
    expect((await body(res)).error.code).toBe("REQUEST_INVALID");
  });

  it("answers 503 only for an unexpected failure", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const res = jsonError(new Error("database down"));
      expect(res.status).toBe(503);
      expect((await body(res)).error.retryable).toBe(true);
    } finally {
      console.error = original;
    }
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(1) }).strict();
  const req = (text: string) => new Request("http://localhost/x", { method: "POST", body: text });

  it("reads JSON and validates it", async () => {
    await expect(parseBody(req('{"name":"a"}'), schema)).resolves.toEqual({ name: "a" });
  });

  it("refuses a body that is not JSON with 400", async () => {
    await expect(parseBody(req("{"), schema)).rejects.toMatchObject({ status: 400, code: "REQUEST_INVALID" });
  });

  it("names the field that failed", async () => {
    await expect(parseBody(req('{"name":""}'), schema)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("name") });
    await expect(parseBody(req('{"name":"a","extra":1}'), schema)).rejects.toMatchObject({ status: 400 });
  });
});
