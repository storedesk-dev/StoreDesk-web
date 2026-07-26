"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type StoreRow = {
  _id: string;
  name: string;
  storeId: string;
  agentKey: string;
  status: string;
  entitlements: string[];
};

export default function AdminPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/stores");
    const data = await res.json();
    setStores(data.stores ?? []);
    setSource(data.source ?? "");
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string) {
    await fetch(`/api/stores/${id}/rotate`, { method: "POST" });
    await load();
  }

  async function toggleSuspend(id: string, status: string) {
    await fetch(`/api/stores/${id}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "active" ? "suspended" : "active" })
    });
    await load();
  }

  return (
    <main className="min-h-screen bg-[#050608] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-semibold text-[var(--sd-mint)]">
              ← StoreDesk
            </Link>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Store licenses</h1>
            <p className="text-sm text-white/50">
              Registry: <strong className="text-white/80">{source || "…"}</strong>
              {source === "memory" ? " — set MONGODB_URI for Atlas" : ""}
            </p>
          </div>
          <Link href="/admin/agents" className="text-sm font-semibold text-[var(--sd-blue)]">
            Agents →
          </Link>
        </div>

        <form
          onSubmit={onCreate}
          className="mb-8 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <input
            className="min-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
            placeholder="Store name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            Create store
          </button>
        </form>
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">STORE_ID</th>
                <th className="px-4 py-3">AGENT_KEY</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s._id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-semibold">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{s.storeId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{s.agentKey.slice(0, 18)}…</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.status === "active"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400"
                          : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400"
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void rotate(s._id)}
                        className="text-xs font-bold text-[var(--sd-blue)]"
                      >
                        Rotate key
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleSuspend(s._id, s.status)}
                        className="text-xs font-bold text-white/50"
                      >
                        {s.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-white/40">
                    No stores yet. Create one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
