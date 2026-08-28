"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

interface OrganizationItem {
  _id: string;
  organizationId: string;
  name: string;
  status: string;
  stores?: unknown[];
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/organizations");
        const data = await res.json();
        setOrganizations(data.organizations || []);
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
        <button className="flex items-center gap-2 bg-[var(--sd-blue)] text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Create Organization
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--muted)] text-xs uppercase tracking-wider border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Org ID</th>
              <th className="px-6 py-4 font-semibold">Stores</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--muted)]">Loading organizations...</td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[var(--muted)]">No organizations found.</td>
              </tr>
            ) : (
              organizations.map((org: OrganizationItem) => (
                <tr key={org._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{org.name}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-[var(--muted)]">{org.organizationId}</td>
                  <td className="px-6 py-4">{org.stores?.length || 0} stores</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/organizations/${org.organizationId}`} className="text-[var(--sd-blue)] hover:underline font-medium">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
