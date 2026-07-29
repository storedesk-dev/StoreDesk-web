import { NextResponse } from "next/server";
import { enrollAppUser, jsonError } from "@/lib/control-plane";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      enrollmentCredential?: string;
      password?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
    };
    if (!body.enrollmentCredential || !body.password || !body.audience || !body.deviceName) {
      return NextResponse.json({ error: "Missing enrollment fields" }, { status: 400 });
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
