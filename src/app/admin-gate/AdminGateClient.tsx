"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminGateClient() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050608] px-4 text-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_40px_rgba(26,99,244,0.15)]"
      >
        <h1 className="text-lg font-extrabold tracking-tight">StoreDesk admin</h1>
        <p className="mt-1 text-sm text-white/45">Enter password to continue.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className="mt-5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm outline-none focus:border-[var(--sd-blue)]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] py-2.5 text-sm font-bold disabled:opacity-60"
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
