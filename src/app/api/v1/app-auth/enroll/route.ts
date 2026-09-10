import { NextResponse } from "next/server";
import { enrollAppUser, jsonError } from "@/lib/control-plane";

/** Matches the /enroll form. */
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      enrollmentCredential?: string;
      password?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
    };
    if (!body.enrollmentCredential || !body.password || !body.audience || !body.deviceName) {
      return NextResponse.json(
        { error: { code: "REQUEST_INVALID", message: "Missing enrollment fields" } },
        { status: 400 }
      );
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
