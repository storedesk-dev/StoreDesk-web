import Link from "next/link";

export default function SetupKeysPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--sd-blue)]">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Setup Keys</h1>
      <p className="mb-6 text-sm text-slate-600">
        This page will list all generated Setup Keys used to bootstrap StoreDesk Workers. UI is under construction.
      </p>
    </main>
  );
}
