"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrganizationItem {
  _id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  stores?: unknown[];
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Org State
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {
    setLoading(true);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/v1/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug,
          billingEmail: newOrgEmail
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        setNewOrgEmail("");
        loadOrganizations();
      } else {
        alert("Failed to create organization");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Organizations</h1>
          <p className="text-[var(--muted)] mt-1">Manage tenants, stores, and control plane hierarchy.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[var(--sd-blue)] text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/50 text-[var(--muted)] text-xs uppercase tracking-wider border-b border-gray-200/60">
            <tr>
              <th className="px-6 py-5 font-semibold">Name</th>
              <th className="px-6 py-5 font-semibold">Org ID</th>
              <th className="px-6 py-5 font-semibold">Stores</th>
              <th className="px-6 py-5 font-semibold">Status</th>
              <th className="px-6 py-5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)] mx-auto" />
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted)]">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org._id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-semibold text-gray-900">{org.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">/{org.slug}</div>
                  </td>
                  <td className="px-6 py-5 font-mono text-[11px] text-gray-400 bg-gray-50/50 rounded inline-block mt-4 ml-4 mb-4 border border-gray-100">
                    {org.organizationId}
                  </td>
                  <td className="px-6 py-5">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium">
                      {org.stores?.length || 0}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      org.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}>
                      {org.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link 
                      href={`/admin/organizations/${org.organizationId}`} 
                      className="inline-flex items-center text-[var(--sd-blue)] font-medium opacity-80 group-hover:opacity-100 transition-opacity"
                    >
                      Manage <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">New Organization</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <form id="create-org-form" onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input 
                    type="text" 
                    required
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input 
                    type="text" 
                    required
                    value={newOrgSlug}
                    onChange={e => setNewOrgSlug(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="e.g. acme-corp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                  <input 
                    type="email" 
                    value={newOrgEmail}
                    onChange={e => setNewOrgEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="billing@acme.com"
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="create-org-form"
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium bg-[var(--sd-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
