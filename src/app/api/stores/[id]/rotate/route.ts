import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy agent-key rotation was retired. Use setup-v1 Worker credential rotation."
    },
    { status: 410 }
  );
}
