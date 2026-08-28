"use client";

import { useEffect, useState } from "react";
import { Building2, KeyRound, Server } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ organizations: 0, stores: 0, activeWorkers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/organizations");
        const data = await res.json();
        // Since we don't have a dedicated stats endpoint yet, derive from orgs list
        const orgs = data.organizations || [];
        setStats({
          organizations: orgs.length,
          stores: orgs.reduce((acc: number, org: Record<string, unknown>) => acc + (Array.isArray(org.stores) ? org.stores.length : 0), 0),
          activeWorkers: 0 // Mock for now until we build the worker query
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Control Plane Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--muted)]">Organizations</h2>
          </div>
          <p className="text-4xl font-bold">{loading ? "..." : stats.organizations}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Server className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--muted)]">Active Edges</h2>
          </div>
          <p className="text-4xl font-bold">{loading ? "..." : stats.activeWorkers}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--muted)]">Pending Keys</h2>
          </div>
          <p className="text-4xl font-bold">0</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Link href="/admin/organizations" className="px-4 py-2 bg-[var(--sd-blue)] text-white rounded-lg font-medium hover:bg-blue-700">
            Manage Organizations
          </Link>
          <Link href="/admin/setup-keys" className="px-4 py-2 bg-white border border-[var(--border)] text-[var(--foreground)] rounded-lg font-medium hover:bg-gray-50">
            Issue Setup Key
          </Link>
        </div>
      </div>
    </div>
  );
}
