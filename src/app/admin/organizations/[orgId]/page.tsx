"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Store, Users, ArrowLeft, Loader2, Server, CreditCard } from "lucide-react";

export default function AdminOrganizationDetailPage() {
  const { orgId } = useParams();
  const [org, setOrg] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stores");

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  async function loadData() {
    setLoading(true);
    try {
      const [orgRes, storesRes] = await Promise.all([
        fetch(`/api/v1/admin/organizations/${orgId}`),
        fetch(`/api/v1/admin/organizations/${orgId}/stores`)
      ]);
      const orgData = await orgRes.json();
      const storesData = await storesRes.json();
      
      setOrg(orgData.organization);
      setStores(storesData.stores || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--sd-blue)]" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Organization not found</h2>
        <Link href="/admin/organizations" className="text-[var(--sd-blue)] hover:underline mt-4 inline-block">
          Return to Organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <Link href="/admin/organizations" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Organizations
      </Link>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden mb-8">
        <div className="p-8 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{org.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                  {org.organizationId}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  org.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {org.status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Billing Email</div>
              <div className="font-medium text-gray-900">{org.billingEmail || "Not configured"}</div>
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-200/60 bg-gray-50/50 px-8 gap-8">
          <button 
            onClick={() => setActiveTab("stores")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'stores' ? 'border-[var(--sd-blue)] text-[var(--sd-blue)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Store className="h-4 w-4" /> Stores ({stores.length})
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'users' ? 'border-[var(--sd-blue)] text-[var(--sd-blue)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4" /> App Users
          </button>
          <button 
            onClick={() => setActiveTab("billing")}
            className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'billing' ? 'border-[var(--sd-blue)] text-[var(--sd-blue)]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard className="h-4 w-4" /> Billing & Licenses
          </button>
        </div>

        <div className="p-0">
          {activeTab === "stores" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/50 text-[var(--muted)] text-xs uppercase tracking-wider border-b border-gray-200/60">
                  <tr>
                    <th className="px-8 py-5 font-semibold">Store Name</th>
                    <th className="px-8 py-5 font-semibold">Store ID</th>
                    <th className="px-8 py-5 font-semibold">Status</th>
                    <th className="px-8 py-5 font-semibold">Tunnel URL</th>
                    <th className="px-8 py-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-[var(--muted)]">
                        <Store className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                        No stores provisioned yet.
                      </td>
                    </tr>
                  ) : (
                    stores.map(store => (
                      <tr key={store._id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-8 py-5 font-medium text-gray-900">{store.name}</td>
                        <td className="px-8 py-5 font-mono text-[11px] text-gray-500">{store.storeId}</td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            store.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {store.status}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          {store.tunnelUrl ? (
                            <a href={store.tunnelUrl} target="_blank" rel="noreferrer" className="text-[var(--sd-blue)] hover:underline truncate max-w-[200px] block">
                              {store.tunnelUrl.replace("https://", "")}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Not configured</span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Link 
                            href={`/admin/organizations/${orgId}/stores/${store.storeId}`} 
                            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--sd-blue)] transition-colors shadow-sm"
                          >
                            Configure
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "users" && (
            <div className="p-12 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">App Users Management</h3>
              <p>User management module will be implemented here.</p>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="p-12 text-center text-gray-500">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Billing Overview</h3>
              <p>Subscription and license management will be implemented here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
