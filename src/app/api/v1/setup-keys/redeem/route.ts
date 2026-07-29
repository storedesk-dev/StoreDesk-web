import { NextResponse } from "next/server";
import { jsonError, redeemSetupKey } from "@/lib/control-plane";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.setupKey || !body?.acknowledgements || !body?.installation) {
      return NextResponse.json(
        {
          error: {
            code: "ACTIVATION_REQUEST_INVALID",
            message: "Malformed activation payload",
            correlationId: "corr_invalid",
            retryable: false
          }
        },
        { status: 400 }
      );
    }
    const result = await redeemSetupKey(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
