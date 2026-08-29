import Link from "next/link";

export default function AuditLogsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--sd-blue)]">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Audit Logs</h1>
      <p className="mb-6 text-sm text-slate-600">
        This page will display security events, login history, and admin actions. UI is under construction.
      </p>
    </main>
  );
}
