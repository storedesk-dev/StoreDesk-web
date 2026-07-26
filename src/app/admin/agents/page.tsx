import Link from "next/link";

const MOCK_AGENTS = [
  { storeId: "SD-DEMO01", hostname: "hop-in-pos", lastSeen: "—", status: "never_connected" },
  { storeId: "SD-DEMO02", hostname: "front-counter", lastSeen: "—", status: "never_connected" }
];

export default function AgentsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-sm font-semibold text-[var(--sd-blue)]">
        ← Licenses
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Edge agents</h1>
      <p className="mb-6 text-sm text-slate-600">
        Placeholder registry for Cloud Hub heartbeats. Real online status lands with the Hub epic.
      </p>
      <div className="overflow-x-auto rounded-xl border border-black/8 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">STORE_ID</th>
              <th className="px-4 py-3">Hostname</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_AGENTS.map((a) => (
              <tr key={a.storeId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{a.storeId}</td>
                <td className="px-4 py-3">{a.hostname}</td>
                <td className="px-4 py-3">{a.lastSeen}</td>
                <td className="px-4 py-3 text-slate-500">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
