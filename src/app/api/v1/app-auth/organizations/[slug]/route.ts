import { NextResponse } from "next/server";
import { jsonError, lookupOrganization } from "@/lib/control-plane";
import { enforceRateLimit } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Public: the phone calls this when the user types the org tag, before the
 * sign-in form (the desktop is set up by its setup key instead). It answers
 * with the organization's name and its active stores' public addresses and
 * remote reachability (`remote: {status, since}`, see `lookupOrganization`),
 * and is rate-limited per caller so the tag space cannot be walked quickly.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const caller = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    enforceRateLimit(`org-lookup:${caller}`, { limit: 30, windowMs: 60_000 });
    const { slug } = await ctx.params;
    return NextResponse.json(await lookupOrganization(slug));
  } catch (error) {
    return jsonError(error);
  }
}
