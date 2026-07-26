"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { defaultSupportEndsAt, type LicensePlan } from "@/lib/stores";

type StoreRow = {
  _id: string;
  name: string;
  storeId: string;
  agentKey: string;
  status: string;
  entitlements: string[];
  licensePlan: string;
  supportEndsAt: string;
};

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export default function AdminPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [source, setSource] = useState<string>("");
  const [name, setName] = useState("");
  const [licensePlan, setLicensePlan] = useState<LicensePlan>("trial");
  const [supportEndsAt, setSupportEndsAt] = useState(() => toDateInput(defaultSupportEndsAt("trial")));
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setSupportEndsAt(toDateInput(defaultSupportEndsAt(licensePlan, supportEndsAt)));
    } catch {
      /* custom keeps current */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when plan changes
  }, [licensePlan]);

  const supportLabel = useMemo(() => {
    try {
      return new Date(supportEndsAt + "T23:59:59.000Z").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return supportEndsAt;
    }
  }, [supportEndsAt]);

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
      if (!confirmCheck) throw new Error("Check the support-period confirmation box");
      if (confirmPhrase !== "CONFIRM") throw new Error('Type CONFIRM in the confirmation field');

      const ok = window.confirm(
        `Issue license for "${name}"?\n\nPlan: ${licensePlan}\nSupport ends: ${supportLabel}\n\nThis cannot be undone from this dialog.`
      );
      if (!ok) return;

      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          licensePlan,
          supportEndsAt: new Date(supportEndsAt + "T23:59:59.000Z").toISOString(),
          supportConfirmed: true,
          confirmPhrase: "CONFIRM"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setName("");
      setConfirmCheck(false);
      setConfirmPhrase("");
      setLicensePlan("trial");
      setSupportEndsAt(toDateInput(defaultSupportEndsAt("trial")));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function rotate(id: string) {
    if (!window.confirm("Rotate AGENT_KEY? The old key stops working immediately.")) return;
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
    <main className="min-h-screen bg-[var(--surface)] px-6 py-8 text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Store licenses</h1>
            <p className="text-sm text-[var(--muted)]">
              Registry: <strong className="text-[var(--foreground)]">{source || "…"}</strong>
              {source === "memory" ? " — set MONGODB_URI for Atlas" : ""}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/agents" className="text-sm font-semibold text-[var(--sd-blue)]">
              Agents →
            </Link>
            <button
              type="button"
              className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => {
                void fetch("/api/admin/login", { method: "DELETE" }).then(() => {
                  window.location.href = "/admin-gate";
                });
              }}
            >
              Lock
            </button>
          </div>
        </div>

        <form
          onSubmit={onCreate}
          className="mb-8 space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[200px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm placeholder:text-[var(--muted)]"
              placeholder="Store name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              value={licensePlan}
              onChange={(e) => setLicensePlan(e.target.value as LicensePlan)}
            >
              <option value="trial">Trial (default 30 days)</option>
              <option value="standard">Standard (default 365 days)</option>
              <option value="custom">Custom end date</option>
            </select>
            <input
              type="date"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
              value={supportEndsAt}
              onChange={(e) => setSupportEndsAt(e.target.value)}
              required
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmCheck}
              onChange={(e) => setConfirmCheck(e.target.checked)}
            />
            <span>
              I confirm this license includes support through{" "}
              <strong className="text-[var(--foreground)]">{supportLabel}</strong> ({licensePlan}).
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <input
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm uppercase"
              placeholder="Type CONFIRM"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value.toUpperCase())}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--sd-blue)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 hover:bg-[var(--sd-blue-shadow)]"
            >
              Issue license
            </button>
          </div>
        </form>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">STORE_ID</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Support ends</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => {
                const expired = new Date(s.supportEndsAt).getTime() < Date.now();
                return (
                  <tr key={s._id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{s.storeId}</td>
                    <td className="px-4 py-3 text-xs font-bold uppercase text-[var(--muted)]">
                      {s.licensePlan || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={expired ? "font-semibold text-amber-700" : "text-[var(--muted)]"}>
                        {s.supportEndsAt ? new Date(s.supportEndsAt).toLocaleDateString() : "—"}
                        {expired ? " · expired" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          s.status === "active"
                            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"
                            : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700"
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
                          className="text-xs font-bold text-[var(--muted)]"
                        >
                          {s.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                    No stores yet. Issue a license above.
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
