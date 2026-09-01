"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Store, Users, ArrowLeft, Loader2, UserPlus, RefreshCw, Mail, CreditCard, Shield, Plus, Trash2, Monitor, Smartphone } from "lucide-react";
import { RolePreview } from "./RolePreview";
import { getPage } from "@/config/pages";

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

type Subscription = {
  _id: string;
  subscriptionId: string;
  plan: string;
  status: string;
  startsAt: string;
  supportEndsAt?: string;
  maxStores: number;
  maxWorkerInstallations: number;
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

export type PageConfigEntry = { key: string; enabled: boolean; featureFlags: Record<string, boolean> };
export type RoleConfigEntry = {
  roleName: string;
  roleId: string;
  accessKeys: {
    electron: { pages: PageConfigEntry[] };
    mobile: { pages: PageConfigEntry[] };
  };
};

export default function AdminOrganizationDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<Org | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [appUsers, setAppUsers] = useState<OrgUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [subsLoading, setSubsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"stores" | "users" | "subscriptions" | "roles">("stores");
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreId, setNewStoreId] = useState("");
  const [newStoreSlug, setNewStoreSlug] = useState("");
  const [createStoreBusy, setCreateStoreBusy] = useState(false);

  // Organization Roles State
  const [orgRoles, setOrgRoles] = useState<RoleConfigEntry[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("org_admin");
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<"electron" | "mobile">("electron");

  // New Subscription State
  const [subPlan, setSubPlan] = useState<"trial" | "standard" | "custom">("trial");
  const [subStores, setSubStores] = useState(5);
  const [subWorkers, setSubWorkers] = useState(5);
  const [subDays, setSubDays] = useState(30);

  // New App User State
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("org_admin");
  const [newUserStoreId, setNewUserStoreId] = useState("");
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [generatedSetupKey, setGeneratedSetupKey] = useState<string | null>(null);

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
      const usersList = data.appUsers || [];
      setAppUsers(usersList);
      if (usersList.length === 0) {
        setNewUserRole("org_admin");
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  }, [orgId]);

  const loadSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/subscriptions`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSubsLoading(false);
    }
  }, [orgId]);

  const loadOrgRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/roles`);
      const data = await res.json();
      if (data.roles) setOrgRoles(data.roles);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setRolesLoading(false);
    }
  }, [orgId]);

  const saveOrgRoles = async (newRoles: RoleConfigEntry[]) => {
    setRolesSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: newRoles })
      });
      if (res.ok) {
        const data = await res.json();
        setOrgRoles(data.roles);
      } else {
        alert("Failed to save organization roles");
      }
    } catch (err: unknown) {
      alert("Error saving organization roles: " + (err as Error).message);
    } finally {
      setRolesSaving(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      loadData();
      loadOrgRoles();
    }
  }, [loadData, loadOrgRoles, orgId]);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "subscriptions") loadSubscriptions();
    if (activeTab === "roles") loadOrgRoles();
  }, [activeTab, loadUsers, loadSubscriptions, loadOrgRoles]);

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

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          plan: subPlan, 
          maxStores: Number(subStores), 
          maxWorkerInstallations: Number(subWorkers),
          entitlementDays: Number(subDays)
        })
      });
      if (res.ok) {
        setIsCreatingSubscription(false);
        loadSubscriptions();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create subscription");
      }
    } catch (err: unknown) {
      setSubPlan("trial");
      setSubStores(5);
      setSubWorkers(5);
      setSubDays(30);
      loadSubscriptions();
      console.error(err);
      alert("Failed to create subscription: " + (err as Error).message);
    } finally {
      setSubsLoading(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!confirm("Are you ABSOLUTELY sure you want to delete this Organization? This will cascade delete ALL associated Stores, Users, Setup Keys, Subscriptions, and Worker Installations. This cannot be undone.")) {
      return;
    }
    
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/organizations");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete organization");
      }
    } catch {
      alert("Failed to delete organization");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserBusy(true);
    try {
      const payload: Record<string, string> = {
        email: newUserEmail,
        name: newUserName,
        password: newUserPassword,
        role: newUserRole
      };
      if (newUserStoreId) {
        payload.storeId = newUserStoreId;
      }
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/app-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsCreatingUser(false);
        setNewUserEmail("");
        setNewUserName("");
        setNewUserPassword("");
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create user");
      }
    } catch (err: unknown) {
      console.error(err);
      alert("Failed to create user: " + (err as Error).message);
    } finally {
      setCreateUserBusy(false);
    }
  };

  if (loading && !org) {
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
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Billing Email</div>
                <div className="font-medium text-gray-900">{org.billingEmail || "Not configured"}</div>
              </div>
              <button
                onClick={handleDeleteOrg}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Organization
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200/60 bg-gray-50/50 px-8 gap-8">
          {([
            { key: "stores", label: `Stores (${stores.length})`, icon: Store },
            { key: "users", label: `App Users (${appUsers.length})`, icon: Users },
            { key: "subscriptions", label: `Subscriptions`, icon: CreditCard },
            { key: "roles", label: `Roles & Access (${orgRoles.length})`, icon: Shield },
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
                        <td className="px-8 py-5 font-medium text-gray-900 flex items-center gap-2">
                            {store.name}
                            <div className="group relative flex items-center justify-center cursor-help" title={store.storeId}>
                              <div className="h-4 w-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-bold">i</div>
                            </div>
                          </td>
                        
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
                <div className="flex gap-2">
                  <button
                    onClick={loadUsers}
                    disabled={usersLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 px-3 py-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setIsCreatingUser(true)}
                    disabled={usersLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    New App User
                  </button>
                </div>
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
                        <th className="px-8 py-5 font-semibold">Assigned Role & Stores</th>
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
                              <span className="text-gray-400 text-xs italic">No assignments</span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {user.assignments.map((a, i) => {
                                  const roleChipStyles: Record<string, string> = {
                                    org_admin: "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold",
                                    store_manager: "bg-blue-50 text-blue-700 border-blue-200",
                                    store_operator: "bg-amber-50 text-amber-700 border-amber-200",
                                    viewer: "bg-gray-50 text-gray-600 border-gray-200",
                                  };
                                  const roleLabels: Record<string, string> = {
                                    org_admin: "Org Admin",
                                    store_manager: "Store Manager",
                                    store_operator: "Store Operator",
                                    viewer: "Viewer",
                                  };
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${roleChipStyles[a.role] || "bg-gray-50 text-gray-700 border-gray-200"}`}>
                                        {roleLabels[a.role] || a.role}
                                      </span>
                                      <span className="text-xs font-mono text-gray-500">
                                        {a.storeId ? `Store #${a.storeId}` : "All Stores"}
                                      </span>
                                    </div>
                                  );
                                })}
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

              {/* Roles & Permissions Matrix Overview */}
              <div className="p-8 border-t border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Organization Roles & System Access</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                      Org Admin (Default 1st User)
                    </div>
                    <p className="text-xs text-gray-600 mb-2">Full administrative access across all stores, edge workers, user management, and store settings.</p>
                    <div className="text-[11px] font-mono text-indigo-600 bg-indigo-50/50 p-2 rounded border border-indigo-100">
                      All Desktop + Mobile pages enabled with full feature flags.
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                      Store Manager
                    </div>
                    <p className="text-xs text-gray-600 mb-2">Manages store inventory, vendor prices, pricing rules, cost analysis, and transactions.</p>
                    <div className="text-[11px] font-mono text-blue-600 bg-blue-50/50 p-2 rounded border border-blue-100">
                      Desktop & Mobile inventory + pricing controls.
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-2">
                      Store Operator
                    </div>
                    <p className="text-xs text-gray-600 mb-2">Cashier & store clerk — operates POS, scans items, and views daily transactions.</p>
                    <div className="text-[11px] font-mono text-amber-600 bg-amber-50/50 p-2 rounded border border-amber-100">
                      POS, Scanner, and basic Transaction views.
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 mb-2">
                      Viewer
                    </div>
                    <p className="text-xs text-gray-600 mb-2">Read-only auditor or accountant — views dashboard metrics and transactions.</p>
                    <div className="text-[11px] font-mono text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                      Dashboard and Product list read-only access.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Subscriptions Tab ─── */}
          {activeTab === "subscriptions" && (
            <div>
              <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">Manage billing and limits for this organization.</p>
                <div className="flex gap-2">
                  <button
                    onClick={loadSubscriptions}
                    disabled={subsLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 px-3 py-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${subsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setIsCreatingSubscription(true)}
                    disabled={subsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    New Subscription
                  </button>
                </div>
              </div>
              
              {subsLoading && subscriptions.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--sd-blue)]" />
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Subscriptions</h3>
                  <p className="text-sm">This organization does not have an active billing plan or trial.</p>
                </div>
              ) : (
                <div className="p-8 grid gap-4 grid-cols-1 md:grid-cols-2">
                  {subscriptions.map(sub => (
                    <div key={sub._id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-gray-900 capitalize">{sub.plan} Plan</h4>
                          <p className="text-xs text-gray-500 font-mono mt-1">{sub.subscriptionId}</p>
                        </div>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-auto">
                        <div>
                          <div className="text-gray-500 text-xs">Max Stores</div>
                          <div className="font-medium">{sub.maxStores}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Max Workers</div>
                          <div className="font-medium">{sub.maxWorkerInstallations}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Starts</div>
                          <div className="font-medium">{fmtDate(sub.startsAt)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 text-xs">Ends</div>
                          <div className="font-medium">{fmtDate(sub.supportEndsAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Organization Roles Tab ─── */}
          {activeTab === "roles" && (
            <div>
              <div className="px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Organization-Wide Custom Roles</h3>
                  <p className="text-xs text-gray-500">
                    Roles created here are saved in the organization database record and shared across all stores in this organization.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadOrgRoles}
                    disabled={rolesLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50 px-3 py-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rolesLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      const rName = prompt("Enter Custom Role Name (e.g. Cashier, Shift Supervisor):");
                      if (!rName || !rName.trim()) return;
                      const rId = prompt("Enter Custom Role ID (e.g. cashier, shift_supervisor):", rName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")) || "";
                      if (!rId || !rId.trim()) return;

                      if (orgRoles.some(r => r.roleId === rId.trim())) {
                        alert(`Role ID "${rId.trim()}" already exists.`);
                        return;
                      }

                      const newRole: RoleConfigEntry = {
                        roleName: rName.trim(),
                        roleId: rId.trim(),
                        accessKeys: {
                          electron: {
                            pages: [
                              { key: "pos",            enabled: true,  featureFlags: { enableRefunds: false, enableDiscounts: false } },
                              { key: "dashboard",      enabled: true,  featureFlags: {} },
                              { key: "products",       enabled: true,  featureFlags: {} },
                              { key: "vendors",        enabled: false, featureFlags: {} },
                              { key: "vendorPrices",   enabled: false, featureFlags: {} },
                              { key: "priceBook",      enabled: false, featureFlags: {} },
                              { key: "pricingRules",   enabled: false, featureFlags: {} },
                              { key: "costAnalysis",   enabled: false, featureFlags: {} },
                              { key: "transactions",   enabled: true,  featureFlags: {} },
                              { key: "manageWorker",   enabled: false, featureFlags: {} },
                              { key: "settings",       enabled: false, featureFlags: {} }
                            ]
                          },
                          mobile: {
                            pages: [
                              { key: "mobilePos",           enabled: true,  featureFlags: {} },
                              { key: "mobileDashboard",      enabled: true,  featureFlags: {} },
                              { key: "mobileScanner",        enabled: true,  featureFlags: {} },
                              { key: "mobileProductSearch",  enabled: true,  featureFlags: {} },
                              { key: "mobileVendorPrices",   enabled: false, featureFlags: {} },
                              { key: "mobilePriceBook",      enabled: false, featureFlags: {} },
                              { key: "mobileTransactions",   enabled: false, featureFlags: {} },
                              { key: "mobileReports",        enabled: false, featureFlags: {} },
                              { key: "mobileAnalytics",      enabled: false, featureFlags: {} },
                              { key: "mobileSalesTax",       enabled: false, featureFlags: {} }
                            ]
                          }
                        }
                      };

                      setSelectedRoleId(rId.trim());
                      saveOrgRoles([...orgRoles, newRole]);
                    }}
                    disabled={rolesSaving || rolesLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--sd-blue)] text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Custom Role
                  </button>
                </div>
              </div>

              {rolesLoading && orgRoles.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--sd-blue)]" />
                </div>
              ) : (
                <div className="flex flex-col min-h-[600px] border-t border-gray-100">
                  {/* Right Column: Platform Tabs & Page/Feature Matrix */}
                  <div className="bg-white flex flex-col min-h-[600px]">
                    {(() => {
                      const activeRole = orgRoles.find(r => r.roleId === (selectedRoleId || orgRoles[0]?.roleId)) || orgRoles[0];
                      if (!activeRole) return null;

                      const ri = orgRoles.findIndex(r => r.roleId === activeRole.roleId);
                      const isCorePage = (k: string) => k === "dashboard" || k === "settings" || k === "mobileDashboard";

                      const togglePage = (app: "electron" | "mobile", pageKey: string) => {
                        if (isCorePage(pageKey)) {
                          alert(`"${pageKey}" is a core system page and is always enabled.`);
                          return;
                        }
                        const updated: RoleConfigEntry[] = JSON.parse(JSON.stringify(orgRoles));
                        const p = updated[ri].accessKeys[app].pages.find((p: PageConfigEntry) => p.key === pageKey);
                        if (p) p.enabled = !p.enabled;
                        saveOrgRoles(updated);
                      };

                      const toggleFlag = (app: "electron" | "mobile", pageKey: string, flagKey: string) => {
                        const updated: RoleConfigEntry[] = JSON.parse(JSON.stringify(orgRoles));
                        const p = updated[ri].accessKeys[app].pages.find((p: PageConfigEntry) => p.key === pageKey);
                        if (p) {
                          if (!p.featureFlags) p.featureFlags = {};
                          const currentVal = p.featureFlags[flagKey];
                          const flagDef = getPage(pageKey)?.knownFeatureFlags[flagKey];
                          const defaultVal = flagDef ? flagDef.default : true;
                          p.featureFlags[flagKey] = currentVal === undefined ? !defaultVal : !currentVal;
                        }
                        saveOrgRoles(updated);
                      };

                      const deleteRole = () => {
                        if (activeRole.roleId === "org_admin") {
                          alert("Cannot delete Organization Admin role.");
                          return;
                        }
                        if (!confirm(`Delete role "${activeRole.roleName}" (${activeRole.roleId})?`)) return;
                        const nextRoles = orgRoles.filter(r => r.roleId !== activeRole.roleId);
                        setSelectedRoleId(nextRoles[0]?.roleId || "org_admin");
                        saveOrgRoles(nextRoles);
                      };

                      const pageList = activeRole.accessKeys?.[selectedPlatformTab]?.pages || [];

                      return (
                        <div className="flex flex-col h-full">
                          {/* Top Header: Role Name & Platform Switcher */}
                          <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
                            <div>
                              <div className="flex items-center gap-3">
                                <label className="text-sm font-semibold text-gray-700">Role:</label>
                                <select 
                                  value={activeRole.roleId} 
                                  onChange={(e) => setSelectedRoleId(e.target.value)}
                                  className="form-select text-sm border-gray-300 rounded-lg shadow-sm font-medium py-2 pl-3 pr-10 focus:ring-[var(--sd-blue)] focus:border-[var(--sd-blue)]"
                                >
                                  {orgRoles.map(r => (
                                    <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                                  ))}
                                </select>
                              </div>
                            </div>                 <div className="flex items-center gap-4">
                              {/* Platform Tabs Control */}
                              <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                                <button
                                  onClick={() => setSelectedPlatformTab("electron")}
                                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                                    selectedPlatformTab === "electron"
                                      ? "bg-white text-blue-700 shadow-sm"
                                      : "text-gray-500 hover:text-gray-900"
                                  }`}
                                >
                                  <Monitor className="w-4 h-4" />
                                  Desktop
                                </button>
                                <button
                                  onClick={() => setSelectedPlatformTab("mobile")}
                                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                                    selectedPlatformTab === "mobile"
                                      ? "bg-white text-purple-700 shadow-sm"
                                      : "text-gray-500 hover:text-gray-900"
                                  }`}
                                >
                                  <Smartphone className="w-4 h-4" />
                                  Mobile
                                </button>
                              </div>

                              {activeRole.roleId !== "org_admin" && (
                                <button
                                  onClick={deleteRole}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Split View Content */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 flex-1 min-h-0 bg-gray-50/30">
                            
                            {/* Left Side: Pages Config */}
                            <div className="border-r border-gray-100 overflow-y-auto p-5 space-y-4">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Configuration
                              </div>
                              <div className="space-y-3">
                                {pageList.map((page: PageConfigEntry) => {
                                  const isCore = isCorePage(page.key);
                                  const isEnabled = isCore || page.enabled;
                                  const pageDef = getPage(page.key);
                                  const flags = pageDef?.knownFeatureFlags || {};
                                  const flagKeys = Object.keys(flags);

                                  return (
                                    <div key={page.key} className={`rounded-xl border transition-all ${isEnabled ? "bg-white border-gray-200 shadow-sm" : "bg-gray-50/60 border-gray-100 opacity-60"}`}>
                                      <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-bold text-gray-900">{pageDef?.label || page.key}</span>
                                              {isCore && (
                                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">Core</span>
                                              )}
                                            </div>
                                            {pageDef?.description && (
                                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{pageDef.description}</p>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => togglePage(selectedPlatformTab, page.key)}
                                          disabled={isCore}
                                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isEnabled ? "bg-[var(--sd-blue)]" : "bg-gray-200"} ${isCore ? "opacity-60 cursor-not-allowed" : ""}`}
                                          role="switch"
                                          aria-checked={isEnabled}
                                        >
                                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${isEnabled ? "translate-x-5" : "translate-x-0"}`} />
                                        </button>
                                      </div>

                                      {/* Feature Flags Inside Page */}
                                      {isEnabled && flagKeys.length > 0 && (
                                        <div className="px-4 pb-3 pt-2 border-t border-gray-100 bg-gray-50/50 rounded-b-xl space-y-2">
                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                            Feature Flags
                                          </div>
                                          <div className="grid grid-cols-1 gap-2">
                                            {flagKeys.map(fk => {
                                              const fDef = flags[fk];
                                              const isFlagActive = page.featureFlags?.[fk] !== undefined ? page.featureFlags[fk] : fDef.default;
                                              return (
                                                <div key={fk} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                                                  <div className="pr-2">
                                                    <span className="text-xs font-semibold text-gray-800">{fDef.label}</span>
                                                  </div>
                                                  <button
                                                    onClick={() => toggleFlag(selectedPlatformTab, page.key, fk)}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md border transition-colors shrink-0 ${
                                                      isFlagActive ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-gray-100 text-gray-400 border-gray-200"
                                                    }`}
                                                  >
                                                    {isFlagActive ? "ON" : "OFF"}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Right Side: Visual Preview */}
                            <div className="p-5 flex flex-col bg-gray-100/30">
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Live Interface Preview
                              </div>
                              <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden relative">
                                <RolePreview role={activeRole} mode={selectedPlatformTab} />
                              </div>
                            </div>
                            
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Subscription Modal */}
      {isCreatingSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleCreateSubscription}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">Issue Subscription</h2>
              <button 
                type="button" 
                onClick={() => setIsCreatingSubscription(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={subPlan}
                  onChange={e => setSubPlan(e.target.value as "trial" | "standard" | "custom")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                >
                  <option value="trial">Trial</option>
                  <option value="standard">Standard</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Stores</label>
                  <input
                    type="number"
                    value={subStores}
                    onChange={e => setSubStores(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Workers</label>
                  <input
                    type="number"
                    value={subWorkers}
                    onChange={e => setSubWorkers(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  value={subDays}
                  onChange={e => setSubDays(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                  required
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreatingSubscription(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={subsLoading}
                className="px-4 py-2 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {subsLoading ? "Issuing..." : "Start Trial"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create App User Modal */}
      {isCreatingUser && !generatedSetupKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleCreateUser}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">Invite App User</h2>
              <button 
                type="button" 
                onClick={() => setIsCreatingUser(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                  placeholder="manager@store.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (Optional)</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                  placeholder="Enter password"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role ID</label>
                <div className="space-y-2">
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                  >
                    <option value="org_admin">Organization Admin (org_admin)</option>
                    {newUserRole !== "org_admin" && <option value={newUserRole}>{newUserRole}</option>}
                  </select>
                  <input
                    type="text"
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value)}
                    placeholder="or type custom role ID (e.g. cashier, shift_manager)"
                    className="w-full px-4 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[var(--sd-blue)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Store (Optional)</label>
                <select
                  value={newUserStoreId}
                  onChange={e => setNewUserStoreId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"
                >
                  <option value="">-- All Organization Stores --</option>
                  {stores.map(s => (
                    <option key={s.storeId} value={s.storeId}>{s.name} ({s.storeId})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">If blank, the user will have access to all stores in this organization.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreatingUser(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createUserBusy}
                className="px-4 py-2 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {createUserBusy ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generated App User Setup Key Modal */}
      {generatedSetupKey && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center border-b border-gray-100">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <UserPlus className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">User Created Successfully!</h2>
              <p className="text-sm text-gray-500 mb-6">
                Share this Setup Key with the user. They will need it to log in and set their permanent password on their device.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <code className="text-lg font-bold text-[var(--sd-blue)] break-all">
                  {generatedSetupKey}
                </code>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedSetupKey);
                  alert("Setup Key Copied!");
                }}
                className="px-6 py-2.5 bg-[var(--sd-blue)] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Copy Key
              </button>
              <button
                onClick={() => {
                  setGeneratedSetupKey(null);
                  setIsCreatingUser(false);
                  setNewUserEmail("");
                  setNewUserName("");
                }}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
