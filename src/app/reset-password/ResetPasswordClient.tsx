"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";

/**
 * Where somebody who has forgotten their password gets back in.
 *
 * The reset e-mail has told people to open `/reset-password` since it was written, and the page
 * was never built — the same shape of hole `/enroll` was made to fill. The API route existed and
 * worked; there was simply nowhere for a human to use it.
 *
 * Both halves live here, because they are one errand:
 *   **ask** — type the address, and we send a code;
 *   **choose** — paste the code, pick a password.
 *
 * The code is pasted in, never read from the URL. A credential in a query string ends up in server
 * logs, browser history and referrer headers, which is the same rule `/enroll` follows.
 */

const MIN_PASSWORD = 8;

const ERRORS: Record<string, string> = {
  RESET_INVALID: "That code doesn't look right. Check you copied all of it, including the dot in the middle.",
  RESET_CONSUMED: "This code has already been used. Ask for a new one below.",
  RESET_EXPIRED: "This code has expired — they last an hour. Ask for a new one below.",
  PASSWORD_TOO_SHORT: `Choose a password of at least ${MIN_PASSWORD} characters.`,
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again."
};

type Step = "ask" | "choose";
type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "submitting" } | { kind: "done" } | { kind: "error"; message: string };

const messageOf = (data: unknown, fallback: string): string => {
  const error = (data as { error?: { code?: string; message?: string } | string })?.error;
  const code = typeof error === "object" ? error?.code : undefined;
  return (code && ERRORS[code]) || (typeof error === "object" ? (error?.message ?? fallback) : (error ?? fallback));
};

export function ResetPasswordClient() {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("ask");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  // Pasted codes routinely carry a trailing newline or stray spaces.
  const cleanCode = code.replace(/\s+/g, "");
  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const ready = cleanCode.length > 0 && password.length >= MIN_PASSWORD && confirm === password;
  const busy = state.kind === "sending" || state.kind === "submitting";

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/v1/app-auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      // The route answers the same way whether or not the address has an account — it must not
      // become a way to find out who our customers are — so this never reports "no such account".
      if (!res.ok) {
        setState({ kind: "error", message: messageOf(await res.json().catch(() => ({})), "Couldn't send that. Try again.") });
        return;
      }
      setState({ kind: "sent" });
      setStep("choose");
    } catch {
      setState({ kind: "error", message: "Couldn't reach StoreDesk. Check your connection and try again." });
    }
  }

  async function choose(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/v1/app-auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: cleanCode, password })
      });
      if (!res.ok) {
        setState({ kind: "error", message: messageOf(await res.json().catch(() => ({})), "Something went wrong. Try again.") });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Couldn't reach StoreDesk. Check your connection and try again." });
    }
  }

  return (
    <MarketingShell
      eyebrow="Your account"
      title="Reset your password"
      lede="We send a code to your e-mail address. Paste it here and choose a new password."
    >
      <motion.div
        initial={{ y: reduceMotion ? 0 : 10 }}
        animate={{ y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-lg"
      >
        {state.kind === "done" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Your password is changed</h2>
            <p className="mt-2 text-slate-600">
              Sign in with it on the store PC or your phone. Every other device you were signed in on has been
              signed out.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {step === "ask" ? (
              <form onSubmit={ask} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-slate-900">
                    Your e-mail address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    placeholder="you@yourstore.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || email.trim().length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                >
                  {state.kind === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
                  Send me a code
                </button>
                <button type="button" onClick={() => setStep("choose")} className="w-full text-sm text-slate-600 underline">
                  I already have a code
                </button>
              </form>
            ) : (
              <form onSubmit={choose} className="space-y-5">
                {state.kind === "sent" ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                    If that address has an account, a code is on its way. It runs out in an hour.
                  </p>
                ) : null}
                <div>
                  <label htmlFor="reset-code" className="block text-sm font-medium text-slate-900">
                    The code from your e-mail
                  </label>
                  <input
                    id="reset-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                    placeholder="usr_…"
                  />
                </div>
                <div>
                  <label htmlFor="reset-password" className="block text-sm font-medium text-slate-900">
                    New password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                  {tooShort ? <p className="mt-1.5 text-sm text-amber-700">At least {MIN_PASSWORD} characters.</p> : null}
                </div>
                <div>
                  <label htmlFor="reset-confirm" className="block text-sm font-medium text-slate-900">
                    Confirm new password
                  </label>
                  <input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                  {mismatch ? <p className="mt-1.5 text-sm text-amber-700">These two do not match.</p> : null}
                </div>
                <button
                  type="submit"
                  disabled={!ready || busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                >
                  {state.kind === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
                  Change my password
                </button>
                <button type="button" onClick={() => setStep("ask")} className="w-full text-sm text-slate-600 underline">
                  Send me another code
                </button>
              </form>
            )}

            {state.kind === "error" ? (
              <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                {state.message}
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Stuck? Write to{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="font-medium text-emerald-700 underline">
            {SITE.supportEmail}
          </a>
          .
        </p>
      </motion.div>
    </MarketingShell>
  );
}
