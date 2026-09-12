import { NextResponse } from "next/server";
import { enrollAppUser, jsonError } from "@/lib/control-plane";
import { enforceRateLimit } from "@/lib/control-plane-security";

/** Matches the /enroll form. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Enrollment is public (the caller has no account yet) and verifies an argon2
 * secret, so it is rate-limited twice: per caller, and per account. The
 * request carries no email; the account is the `appu_…` id at the front of the
 * enrollment credential, which is the account the invitation e-mail was for.
 */
const ENROLL_WINDOW_MS = 15 * 60_000;
const ENROLL_PER_CALLER = 30;
const ENROLL_PER_ACCOUNT = 10;
const ENROLL_ACCOUNT = /^(appu_[a-f0-9]{32})\./;

export async function POST(req: Request) {
  try {
    const caller = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    enforceRateLimit(`enroll-caller:${caller}`, {
      limit: ENROLL_PER_CALLER,
      windowMs: ENROLL_WINDOW_MS,
      code: "ENROLL_RATE_LIMITED"
    });

    const body = (await req.json()) as {
      enrollmentCredential?: string;
      password?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
    };
    if (
      typeof body.enrollmentCredential !== "string" ||
      !body.enrollmentCredential ||
      typeof body.password !== "string" ||
      !body.password ||
      !body.audience ||
      !body.deviceName
    ) {
      return NextResponse.json(
        { error: { code: "REQUEST_INVALID", message: "Missing enrollment fields" } },
        { status: 400 }
      );
    }

    const account = ENROLL_ACCOUNT.exec(body.enrollmentCredential)?.[1];
    if (account) {
      enforceRateLimit(`enroll-account:${account}`, {
        limit: ENROLL_PER_ACCOUNT,
        windowMs: ENROLL_WINDOW_MS,
        code: "ENROLL_RATE_LIMITED"
      });
    }

    // Enforced here, not only in the form: enrollAppUser hashes whatever it is
    // given, so without this a direct request could set a one-character password.
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: {
            code: "PASSWORD_TOO_SHORT",
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
          }
        },
        { status: 400 }
      );
    }
    const result = await enrollAppUser({
      enrollmentCredential: body.enrollmentCredential,
      password: body.password,
      deviceName: body.deviceName,
      audience: body.audience
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
