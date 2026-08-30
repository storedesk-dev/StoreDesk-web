"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Store, Users, ArrowLeft, Loader2, UserPlus, RefreshCw, Mail
} from "lucide-react";

type OrgUser = {
  appUserId: string;
  email: string;
  name?: string;
  status: "pending_enrollment" | "active" | "disabled";
  lastLoginAt?: string;
  createdAt?: string;
  assignments: { storeId: string; role: string; status: string }[];
};

type Store = {
  _id: string;
  storeId: string;
  name: string;
  status: string;
  tunnelUrl?: string;
  createdAt?: string;
};

type Org = {
  organizationId: string;
  name: string;
  status: string;
  billingEmail?: string;
};


const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  pending_enrollment: "bg-amber-50 text-amber-700 border border-amber-200/60",
  disabled: "bg-red-50 text-red-700 border border-red-200/60",
  trialing: "bg-blue-50 text-blue-700 border border-blue-200/60",
  suspended: "bg-red-50 text-red-700 border border-red-200/60",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminOrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<Org | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [appUsers, setAppUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"stores" | "users">("stores");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [createStoreBusy, setCreateStoreBusy] = useState(false);

  const loadData = useCallback(async () => {
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
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/app-users`);
      const data = await res.json();
      setAppUsers(data.appUsers || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, [orgId]);

  useEffect(() => { if (orgId) loadData(); }, [loadData, orgId]);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
  }, [activeTab, loadUsers]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStoreBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStoreName, storeNumber: newStoreId, slug: newStoreSlug })
      });
      if (res.ok) {
        setIsCreatingStore(false);
        setNewStoreName("");
        setNewStoreId("");
        setNewStoreSlug("");
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create store");
      }
    } catch {
      alert("Failed to create store");
    } finally {
      setCreateStoreBusy(false);
    }
  };

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
        {/* Header */}
        <div className="p-8 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{org.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                  {org.organizationId}
                </span>
                <StatusBadge status={org.status} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Billing Email</div>
              <div className="font-medium text-gray-900">{org.billingEmail || "Not configured"}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200/60 bg-gray-50/50 px-8 gap-8">
          {([
            { key: "stores", label: `Stores (${stores.length})`, icon: Store },
            { key: "users", label: `App Users (${appUsers.length})`, icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === key
                  ? "border-[var(--sd-blue)] text-[var(--sd-blue)]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {/* ─── Stores Tab ─── */}
          {activeTab === "stores" && (
            <div className="overflow-x-auto">
              <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">Stores provisioned under this organization.</p>
                <button
                  onClick={() => setIsCreatingStore(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Store className="h-4 w-4" />
                  Add Store
                </button>
              </div>
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
                      <tr key={store._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-8 py-5 font-medium text-gray-900">{store.name}</td>
                        <td className="px-8 py-5 font-mono text-[11px] text-gray-500">{store.storeId}</td>
                        <td className="px-8 py-5"><StatusBadge status={store.status} /></td>
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

          {/* ─── App Users Tab ─── */}
          {activeTab === "users" && (
            <div>
              <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">App Users with access to this organization.</p>
                <button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--sd-blue)]" />
                </div>
              ) : appUsers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No App Users</h3>
                  <p className="text-sm">No active user assignments for this organization.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/50 text-[var(--muted)] text-xs uppercase tracking-wider border-b border-gray-200/60">
                      <tr>
                        <th className="px-8 py-5 font-semibold">User</th>
                        <th className="px-8 py-5 font-semibold">Status</th>
                        <th className="px-8 py-5 font-semibold">Assigned Stores</th>
                        <th className="px-8 py-5 font-semibold">Last Login</th>
                        <th className="px-8 py-5 font-semibold">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appUsers.map(user => (
                        <tr key={user.appUserId} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[var(--sd-blue)]/10 flex items-center justify-center flex-shrink-0">
                                <Mail className="h-4 w-4 text-[var(--sd-blue)]" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{user.name || user.email}</div>
                                {user.name && <div className="text-xs text-gray-500">{user.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5"><StatusBadge status={user.status} /></td>
                          <td className="px-8 py-5">
                            {user.assignments.length === 0 ? (
                              <span className="text-gray-400 text-xs italic">No stores</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {user.assignments.map((a, i) => (
                                  <span key={i} className="text-xs font-mono text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                                    {a.storeId} · <span className="text-gray-400">{a.role}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-5 text-sm text-gray-600">{fmtDate(user.lastLoginAt)}</td>
                          <td className="px-8 py-5 text-sm text-gray-600">{fmtDate(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Store Modal */}
      {isCreatingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleCreateStore}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">Provision New Store</h2>
              <button 
                type="button" 
                onClick={() => setIsCreatingStore(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[var(--sd-blue)] outline-none"
                  placeholder="e.g. Acme Midtown"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store ID / Number</label>
                <input
                  type="text"
                  value={newStoreId}
                  onChange={e => setNewStoreId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[var(--sd-blue)] outline-none"
                  placeholder="e.g. 101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tunnel Slug</label>
                <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:border-[var(--sd-blue)]">
                  <input
                    type="text"
                    value={newStoreSlug}
                    onChange={e => setNewStoreSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm outline-none"
                    placeholder="e.g. hop-in"
                  />
                  <span className="bg-gray-50 border-l border-gray-200 px-3 py-2 text-sm text-gray-500 font-mono flex-shrink-0">
                    .storedesk.net
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to auto-generate from Store ID</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreatingStore(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createStoreBusy}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--sd-blue)] rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createStoreBusy ? "Creating..." : "Create Store"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
