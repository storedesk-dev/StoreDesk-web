import { NextResponse } from "next/server";
import { callerIp, ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError } from "@/lib/http";
import {
  authorizeLotteryPc,
  lotteryBody,
  lotteryUnbind,
  lotteryUnbindWithCredential,
  pcRateLimit,
  UnbindSchema
} from "@/lib/lottery-pc";

/**
 * `POST /api/v1/lottery/unbind`: Switch store. The PC lets go of its store: its `LotteryPc` becomes
 * `unbound` and every refresh credential on it is revoked. The person's lotterySettings is re-checked
 * against their role now.
 *
 * Two proofs are accepted: a person's access token (`Authorization: Bearer`), or that person's own
 * refresh credential on this PC in the body. The second needs no lottery cloud, so switching store
 * works on a control plane without Supabase.
 */
export async function POST(req: Request) {
  try {
    if (req.headers.get("authorization")) {
      const { claims, pc } = await authorizeLotteryPc(req);
      pcRateLimit("lottery-unbind", String(claims.pc), 10, "RATE_LIMITED");
      const body = await lotteryBody(req, UnbindSchema);
      return NextResponse.json(await lotteryUnbind(claims, pc, body.pcId), { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    enforceRateLimit(`lottery-unbind-ip:${callerIp(req)}`, { limit: 30, windowMs: 60 * 60_000, code: "RATE_LIMITED" });
    const body = await lotteryBody(req, UnbindSchema);
    if (!body.refreshCredential) throw new ControlPlaneError(401, "TOKEN_INVALID", "That token is not valid");
    return NextResponse.json(await lotteryUnbindWithCredential({ pcId: body.pcId, refreshCredential: body.refreshCredential }), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return jsonError(error);
  }
}
