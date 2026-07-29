import { NextResponse } from "next/server";
import { jsonError, loginAppUser } from "@/lib/control-plane";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      deviceName?: string;
      audience?: "desktop" | "mobile";
      deviceId?: string;
    };
    if (!body.email || !body.password || !body.audience) {
      return NextResponse.json({ error: "email, password, and audience are required" }, { status: 400 });
    }
    const result = await loginAppUser({
      email: body.email,
      password: body.password,
      deviceName: body.deviceName,
      audience: body.audience,
      deviceId: body.deviceId
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
