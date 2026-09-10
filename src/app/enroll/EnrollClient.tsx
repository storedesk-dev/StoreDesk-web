"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";

/**
 * Where a new StoreDesk user redeems their enrollment code.
 *
 * Until this page existed, nothing anywhere called `/api/v1/app-auth/enroll`:
 * an owner created from the admin received a code with no place to use it,
 * stayed `pending_enrollment` with no password, and could never sign in.
 *
 * The code is pasted in, never read from the URL. A credential in a query
 * string ends up in server logs, browser history and referrer headers.
 */

const MIN_PASSWORD = 8;

const ERRORS: Record<string, string> = {
  ENROLLMENT_INVALID:
    "That code doesn't look right. Check you copied all of it — it starts with appu_ and has a dot in the middle.",
  ENROLLMENT_CONSUMED:
    "This code has already been used. If that wasn't you, tell whoever set up your account straight away.",
  ENROLLMENT_EXPIRED: "This code has expired. Ask whoever set up your account to send a new one.",
  PASSWORD_TOO_SHORT: `Choose a password of at least ${MIN_PASSWORD} characters.`
};

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "done"; linkedToStore: boolean }
  | { kind: "error"; message: string };

export function EnrollClient() {
  const reduceMotion = useReducedMotion();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  // Pasted codes routinely carry a trailing newline or stray spaces.
  const cleanCode = code.replace(/\s+/g, "");
  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const ready =
    cleanCode.length > 0 && password.length >= MIN_PASSWORD && confirm === password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/v1/app-auth/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentCredential: cleanCode,
          password,
          // Enrollment registers a device. This one is named for where it
          // happened; signing in on the desktop or phone registers those.
          audience: "desktop",
          deviceName: "Set up on the web"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof data?.error === "object" ? data.error?.code : undefined;
        setState({
          kind: "error",
          message:
            (code && ERRORS[code]) ||
            (typeof data?.error === "object" ? data.error?.message : data?.error) ||
            "Something went wrong. Try again, or contact us if it keeps happening."
        });
        return;
      }
      setState({
        kind: "done",
        linkedToStore: Array.isArray(data.assignments) && data.assignments.length > 0
      });
    } catch {
      setState({ kind: "error", message: "Couldn't reach StoreDesk. Check your connection and try again." });
    }
  }

  return (
    <MarketingShell
      eyebrow="Account setup"
      title="Finish setting up your account"
      lede="Paste the enrollment code you were sent and choose a password. It takes a minute."
    >
      <motion.div
        initial={{ y: reduceMotion ? 0 : 10 }}
        animate={{ y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-lg"
      >
        {state.kind === "done" ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00A87B]/10 text-[#00875F]">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-[20px] font-semibold tracking-tight">You&apos;re all set</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
              Sign in to the StoreDesk app with your email and the password you just chose.
            </p>
            {!state.linkedToStore ? (
              <p className="mt-4 rounded-lg border border-[#1A63F4]/20 bg-[#1A63F4]/[0.04] p-3.5 text-[14px] leading-relaxed text-[var(--foreground)]">
                Your account isn&apos;t linked to a store yet. Whoever set it up will add you to your
                store&apos;s access — once they have, the store appears when you sign in.
              </p>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl border border-[var(--border)] bg-white p-7 md:p-8"
          >
            <div>
              <label htmlFor="code" className="block text-[14px] font-medium">
                Enrollment code
              </label>
              <textarea
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                placeholder="appu_…"
                className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] px-3.5 py-2.5 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-[#1A63F4] focus:ring-2 focus:ring-[#1A63F4]/15"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[14px] font-medium">
                Choose a password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#1A63F4] focus:ring-2 focus:ring-[#1A63F4]/15"
              />
              <p className={`mt-1.5 text-[13px] ${tooShort ? "text-[#B42318]" : "text-[var(--muted)]"}`}>
                At least {MIN_PASSWORD} characters.
              </p>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-[14px] font-medium">
                Type it again
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                aria-invalid={mismatch}
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#1A63F4] focus:ring-2 focus:ring-[#1A63F4]/15"
              />
              {mismatch ? (
                <p className="mt-1.5 text-[13px] text-[#B42318]">These don&apos;t match yet.</p>
              ) : null}
            </div>

            {state.kind === "error" ? (
              <p role="alert" className="rounded-lg border border-[#B42318]/20 bg-[#B42318]/[0.04] p-3.5 text-[14px] leading-relaxed text-[#912018]">
                {state.message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!ready || state.kind === "submitting"}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A63F4] px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0E43D8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.kind === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {state.kind === "submitting" ? "Setting up…" : "Set my password"}
            </button>

            <p className="text-center text-[13px] text-[var(--muted)]">
              No code, or it isn&apos;t working?{" "}
              <a href={`mailto:${SITE.supportEmail}?subject=StoreDesk%20enrollment%20code`} className="font-medium text-[#1A63F4] hover:underline">
                Email {SITE.supportEmail}
              </a>
            </p>
          </form>
        )}
      </motion.div>
    </MarketingShell>
  );
}
