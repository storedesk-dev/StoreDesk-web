import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { ControlPlaneError, publicId } from "@/lib/control-plane-security";

/**
 * One error shape for every route: `{ error: { code, message, correlationId,
 * retryable } }`, plus any `details` of a ControlPlaneError beside it.
 *
 * Client mistakes are 4xx: a body that is not JSON or fails its schema (400),
 * a value Mongoose cannot cast or validate (400), a duplicate unique value
 * (409). Only a failure on our side is 503.
 */

type ErrorBody = {
  error: { code: string; message: string; correlationId: string; retryable: boolean };
  [key: string]: unknown;
};

function respond(
  status: number,
  code: string,
  message: string,
  correlationId: string,
  retryable = false,
  details?: Record<string, unknown>
) {
  const body: ErrorBody = { ...(details ?? {}), error: { code, message, correlationId, retryable } };
  return NextResponse.json(body, { status });
}

export function describeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message}`;
}

function duplicateKey(error: unknown): { fields: string[] } | null {
  if (!error || typeof error !== "object") return null;
  const record = error as { code?: unknown; keyValue?: unknown; keyPattern?: unknown };
  if (record.code !== 11000) return null;
  const source = (record.keyValue ?? record.keyPattern) as Record<string, unknown> | undefined;
  return { fields: source && typeof source === "object" ? Object.keys(source) : [] };
}

export function jsonError(error: unknown, correlationId = publicId("corr")) {
  if (error instanceof ControlPlaneError) {
    return respond(error.status, error.code, error.message, correlationId, error.retryable, error.details);
  }
  if (error instanceof z.ZodError) {
    return respond(400, "REQUEST_INVALID", describeZodError(error), correlationId);
  }
  if (error instanceof SyntaxError) {
    return respond(400, "REQUEST_INVALID", "The request body must be JSON", correlationId);
  }
  const duplicate = duplicateKey(error);
  if (duplicate) {
    const field = duplicate.fields.filter((name) => name !== "_id").join(", ") || "value";
    return respond(409, "RESOURCE_EXISTS", `That ${field} is already in use`, correlationId);
  }
  if (error instanceof mongoose.Error.CastError) {
    return respond(400, "REQUEST_INVALID", `${error.path}: invalid value`, correlationId);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    return respond(400, "REQUEST_INVALID", first?.message ?? "Invalid value", correlationId);
  }
  console.error("[control-plane]", correlationId, error);
  // The code is kept: the store server maps it on the activation route.
  return respond(503, "ACTIVATION_UNAVAILABLE", "Control plane temporarily unavailable", correlationId, true);
}

/**
 * The body as JSON; an empty body reads as `{}`. A body sent as anything but
 * `application/json` is 415 (an HTML form cannot send that type, which closes
 * the cross-site form route to every mutation); not JSON → 400.
 */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    throw new ControlPlaneError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the body as application/json");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ControlPlaneError(400, "REQUEST_INVALID", "The request body must be JSON");
  }
}

/** Read and validate the body; a schema failure is 400 with the first issue. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  code = "REQUEST_INVALID"
): Promise<z.output<S>> {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new ControlPlaneError(400, code, describeZodError(parsed.error));
  return parsed.data;
}

/** Validate an already-read value the same way. */
export function parseValue<S extends z.ZodType>(value: unknown, schema: S, code = "REQUEST_INVALID"): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ControlPlaneError(400, code, describeZodError(parsed.error));
  return parsed.data;
}

export function notFound(what = "Resource"): ControlPlaneError {
  return new ControlPlaneError(404, "RESOURCE_NOT_FOUND", `${what} not found`);
}

/** Optional text: trimmed, and empty reads as null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

/** An e-mail-shaped login or address, lower-cased. Need not be a real mailbox. */
export const LOGIN_PATTERN = /^[a-z0-9._%+'-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(LOGIN_PATTERN, "Enter an e-mail-style login, e.g. name@example.com");

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .nullish()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || LOGIN_PATTERN.test(value), "Enter a valid e-mail address");
