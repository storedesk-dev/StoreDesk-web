"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, X, Loader2 } from "lucide-react";

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
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Setup Key Modal State
  const [generatedSetupKey, setGeneratedSetupKey] = useState<string | null>(null);
  const [isSetupKeyModalOpen, setIsSetupKeyModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
          billingEmail: newOrgEmail,
          ownerEmail: newOwnerEmail
        })
      });
      if (res.ok) {
        const data = await res.json();
        setIsModalOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        setNewOrgEmail("");
        setNewOwnerEmail("");
        loadOrganizations();
        
        if (data.setupKey) {
          setGeneratedSetupKey(data.setupKey);
          setIsSetupKeyModalOpen(true);
        }
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
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Initial Organization Admin (Optional)</h3>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email</label>
                  <input 
                    type="email" 
                    value={newOwnerEmail}
                    onChange={e => setNewOwnerEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] focus:border-transparent outline-none transition-all"
                    placeholder="admin@acme.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If provided, this user will automatically be created and assigned as a Manager for all stores in this organization. A one-time Setup Key will be generated.
                  </p>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="create-org-form"
                  disabled={isCreating}
                  className="px-4 py-2 bg-[var(--sd-blue)] text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup Key Modal */}
      {isSetupKeyModalOpen && generatedSetupKey && (
        <div className="fixed inset-0 z-[60] overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsSetupKeyModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsSetupKeyModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="text-center mb-6">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Created!</h2>
              <p className="text-gray-600">
                The Organization has been created and the Owner App User is ready. Share this one-time setup key with them so they can securely log in and set their password.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
              <div className="text-center font-mono text-3xl font-bold tracking-widest text-[var(--sd-blue)] break-all">
                {generatedSetupKey}
              </div>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedSetupKey);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full bg-[var(--sd-blue)] text-white py-3 rounded-xl font-semibold shadow-md hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
            >
              {copied ? "Copied to Clipboard!" : "Copy Setup Key"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
