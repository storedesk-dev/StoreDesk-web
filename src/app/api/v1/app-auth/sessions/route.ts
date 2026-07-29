import { NextResponse } from "next/server";
import { issueClientSession, jsonError } from "@/lib/control-plane";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      appUserId?: string;
      deviceId?: string;
      assignmentId?: string;
      audience?: "desktop" | "mobile";
    };
    if (!body.appUserId || !body.deviceId || !body.assignmentId || !body.audience) {
      return NextResponse.json({ error: "Missing session fields" }, { status: 400 });
    }
    const result = await issueClientSession({
      appUserId: body.appUserId,
      deviceId: body.deviceId,
      assignmentId: body.assignmentId,
      audience: body.audience
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
