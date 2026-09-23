"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, CheckCircle2, Loader2 } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";
import { useCodeFromLink } from "@/lib/use-code-from-link";

/**
 * Where somebody proves the e-mail address their StoreDesk account uses.
 *
 * **One button, and it is pressed by a person.** The obvious design — verify on arrival — breaks
 * against corporate mail security, which fetches every link in a message before its owner sees it
 * (Defender Safe Links, Mimecast, Barracuda). That fetch would spend the code, and the person
 * clicking a minute later would be told their link was invalid with nothing to do about it. So
 * arriving shows a button; pressing it verifies.
 *
 * The code comes out of the URL fragment, which never reaches a server or a log, and is cleared
 * from the address bar (`lib/use-code-from-link.ts`).
 */

const ERRORS: Record<string, string> = {
  VERIFICATION_INVALID: "That link is not valid any more. Ask for a new one and try again.",
  VERIFICATION_EXPIRED: "That link has expired. Ask for a new one and try again.",
  VERIFICATION_RATE_LIMITED: "Too many attempts. Wait a few minutes and try again."
};

type State = { kind: "idle" } | { kind: "working" } | { kind: "done"; email: string | null } | { kind: "error"; message: string };

export function VerifyClient() {
  const reduceMotion = useReducedMotion();
  const fromLink = useCodeFromLink();
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const code = (fromLink ?? typed).replace(/\s+/g, "");

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!code || state.kind === "working") return;
    setState({ kind: "working" });
    try {
      const res = await fetch("/api/v1/app-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorCode = typeof data?.error === "object" ? data.error?.code : undefined;
        setState({
          kind: "error",
          message:
            (errorCode && ERRORS[errorCode]) ||
            (typeof data?.error === "object" ? data.error?.message : data?.error) ||
            "Something went wrong. Try again, or write to us if it keeps happening."
        });
        return;
      }
      setState({ kind: "done", email: data?.user?.email ?? null });
    } catch {
      setState({ kind: "error", message: "Couldn't reach StoreDesk. Check your connection and try again." });
    }
  }

  return (
    <MarketingShell
      eyebrow="Your account"
      title="Confirm your e-mail address"
      lede="One press and your StoreDesk account is confirmed. It tells us this address really reaches you."
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
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              {state.email ? `${state.email} is confirmed` : "Your address is confirmed"}
            </h2>
            <p className="mt-2 text-slate-600">
              Nothing else to do. Sign in on the store PC or your phone whenever you are ready.
            </p>
          </div>
        ) : (
          <form onSubmit={verify} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {fromLink ? null : (
              <div className="mb-5">
                <label htmlFor="verify-code" className="block text-sm font-medium text-slate-900">
                  The code from your e-mail
                </label>
                <input
                  id="verify-code"
                  required
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  placeholder="appu_…"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={!code || state.kind === "working"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            >
              {state.kind === "working" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <BadgeCheck className="h-4 w-4" aria-hidden />
              )}
              Confirm my e-mail address
            </button>

            {state.kind === "error" ? (
              <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                {state.message}
              </p>
            ) : null}
          </form>
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
