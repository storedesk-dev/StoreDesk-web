import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailSchema, PasswordSchema, requestPasswordReset, resetPassword } from "@/lib/accounts";
import { callerIp, enforceRateLimit } from "@/lib/control-plane-security";
import { passwordResetEmail } from "@/lib/email-provider";
import { jsonError, parseBody } from "@/lib/http";

/**
 * `POST /api/v1/app-auth/password-reset` — ask for a link, or use one.
 *
 * Asking always answers the same whether or not we know the address: a reset
 * form that says "no such account" is an account list. Using a link is single
 * use, an hour long, and the new password reaches the person's stores with
 * their next access pull — so a password changed here works at the counter
 * without anybody visiting the store.
 */
const RequestSchema = z.object({ email: EmailSchema });
const ConfirmSchema = z.object({ credential: z.string().min(10).max(200), password: PasswordSchema });
const BodySchema = z.union([ConfirmSchema, RequestSchema]);

const WINDOW_MS = 15 * 60_000;
const PER_CALLER = 20;

export async function POST(req: Request) {
  try {
    enforceRateLimit(`password-reset:${callerIp(req)}`, { limit: PER_CALLER, windowMs: WINDOW_MS, code: "RESET_RATE_LIMITED" });
    const body = await parseBody(req, BodySchema);

    if ("credential" in body) {
      const account = await resetPassword(body.credential, body.password);
      return NextResponse.json({ user: account });
    }

    const started = await requestPasswordReset(body.email);
    if (started) {
      // Until a mail provider is wired up, the message is written where the
      // operator can find it — never the credential itself in an audit row.
      console.info("[password-reset]", passwordResetEmail({ email: started.email, name: started.name, credential: started.credential }));
    }
    return NextResponse.json({ ok: true, message: "If that address has an account, a reset link is on its way." }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
