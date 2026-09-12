"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, errorMessage } from "../admin/_lib/api";
import { BrandLockup } from "../admin/_components/BrandLockup";

const inputClass =
  "block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-[#111827] placeholder:text-slate-400 focus:border-[#1A63F4] focus:outline-none focus:ring-2 focus:ring-[#1A63F4]/25";

export default function AdminGateClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(email.trim(), password);
      router.replace(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed."));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] px-4">
      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-describedby="gate-note">
          <BrandLockup size={32} />
          <h1 className="mt-5 text-lg font-extrabold tracking-tight text-[#111827]">StoreDesk admin</h1>
          <p id="gate-note" className="mt-1 text-sm text-slate-600">
            For StoreDesk staff. Store owners and their staff sign in on the desktop app or phone, not here.
          </p>

          <label htmlFor="gate-email" className="mt-5 block text-[13px] font-semibold text-slate-700">
            E-mail
          </label>
          <input
            id="gate-email"
            type="email"
            autoFocus
            autoComplete="username"
            className={`mt-1 ${inputClass}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="gate-password" className="mt-3 block text-[13px] font-semibold text-slate-700">
            Password
          </label>
          <input
            id="gate-password"
            type="password"
            autoComplete="current-password"
            className={`mt-1 ${inputClass}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? (
            <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1A63F4] text-sm font-bold text-white hover:bg-[#0E43D8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A63F4] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Sign in
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-slate-500">Too many wrong attempts locks sign-in for a few minutes.</p>
      </div>
    </main>
  );
}
