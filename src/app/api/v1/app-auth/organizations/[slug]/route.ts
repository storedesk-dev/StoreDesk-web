import { NextResponse } from "next/server";
import { jsonError, lookupOrganization } from "@/lib/control-plane";
import { enforceRateLimit } from "@/lib/control-plane-security";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Public: the desktop and phone apps call this when the user types their
 * organization, before the sign-in form. It answers with the organization's
 * name only (see `lookupOrganization`), and is rate-limited per caller so the
 * slug space cannot be walked quickly.
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
