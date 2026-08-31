"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Server, ShieldCheck, Activity, KeyRound, Copy, Check, Settings2 } from "lucide-react";
import { JsonEditor } from "../../../../components/JsonEditor";

export default function AdminStoreDetailPage() {
  const { orgId, storeId } = useParams();
    
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Tunnel Status
  const [tunnelStatus, setTunnelStatus] = useState<"checking" | "online" | "offline" | "unknown">("unknown");
  const [tunnelMessage, setTunnelMessage] = useState("");
  const [isDeletingTunnel, setIsDeletingTunnel] = useState(false);
  const [isDeletingStore, setIsDeletingStore] = useState(false);

  // Editable fields
  const [configJson, setConfigJson] = useState("");
  const [licensePlan, setLicensePlan] = useState("");
  const [tunnelUrl, setTunnelUrl] = useState("");

  // Setup Key state
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyExpiresAt, setKeyExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orgId && storeId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, storeId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores/${storeId}`);
      if (!res.ok) throw new Error("Failed to load store");
      const data = await res.json();
      setStore(data.store);
      
      const defaultJson = JSON.stringify({
        posIntegration: "verifone_commander",
        posIpAddress: "",
        posUsername: "",
        posPassword: "",
        roles: [
          {
            roleName: "Organization Admin", roleId: "org_admin",
            accessKeys: {
              electron: { pages: [
                { key: "pos",            enabled: true,  featureFlags: { enableRefunds: true, enableDiscounts: true, enableVoidTransaction: true } },
                { key: "dashboard",      enabled: true,  featureFlags: {} },
                { key: "products",       enabled: true,  featureFlags: { enableBulkImport: true } },
                { key: "vendors",        enabled: true,  featureFlags: {} },
                { key: "vendorPrices",   enabled: true,  featureFlags: {} },
                { key: "priceBook",      enabled: true,  featureFlags: {} },
                { key: "pricingRules",   enabled: true,  featureFlags: {} },
                { key: "costAnalysis",   enabled: true,  featureFlags: {} },
                { key: "transactions",   enabled: true,  featureFlags: { enableExport: true } },
                { key: "manageWorker",   enabled: true,  featureFlags: {} },
                { key: "userManagement", enabled: true,  featureFlags: {} },
                { key: "settings",       enabled: true,  featureFlags: {} }
              ]},
              mobile: { pages: [
                { key: "mobilePos",           enabled: true,  featureFlags: { enableManualEntry: true, enableQuickSale: true } },
                { key: "mobileDashboard",      enabled: true,  featureFlags: {} },
                { key: "mobileScanner",        enabled: true,  featureFlags: { enableCameraFlash: true } },
                { key: "mobileProductSearch",  enabled: true,  featureFlags: {} },
                { key: "mobileVendorPrices",   enabled: true,  featureFlags: {} },
                { key: "mobilePriceBook",      enabled: true,  featureFlags: {} },
                { key: "mobileTransactions",   enabled: true,  featureFlags: { enableExport: true } },
                { key: "mobileReports",        enabled: true,  featureFlags: {} },
                { key: "mobileAnalytics",      enabled: true,  featureFlags: {} },
                { key: "mobileSalesTax",       enabled: true,  featureFlags: {} }
              ]}
            }
          },
          {
            roleName: "Store Manager", roleId: "store_manager",
            accessKeys: {
              electron: { pages: [
                { key: "pos",            enabled: true,  featureFlags: { enableRefunds: true, enableDiscounts: false, enableVoidTransaction: false } },
                { key: "dashboard",      enabled: true,  featureFlags: {} },
                { key: "products",       enabled: true,  featureFlags: { enableBulkImport: false } },
                { key: "vendors",        enabled: true,  featureFlags: {} },
                { key: "vendorPrices",   enabled: true,  featureFlags: {} },
                { key: "priceBook",      enabled: true,  featureFlags: {} },
                { key: "pricingRules",   enabled: true,  featureFlags: {} },
                { key: "costAnalysis",   enabled: true,  featureFlags: {} },
                { key: "transactions",   enabled: true,  featureFlags: { enableExport: true } },
                { key: "manageWorker",   enabled: false, featureFlags: {} },
                { key: "userManagement", enabled: false, featureFlags: {} },
                { key: "settings",       enabled: true,  featureFlags: {} }
              ]},
              mobile: { pages: [
                { key: "mobilePos",           enabled: true,  featureFlags: { enableManualEntry: true, enableQuickSale: false } },
                { key: "mobileDashboard",      enabled: true,  featureFlags: {} },
                { key: "mobileScanner",        enabled: true,  featureFlags: { enableCameraFlash: true } },
                { key: "mobileProductSearch",  enabled: true,  featureFlags: {} },
                { key: "mobileVendorPrices",   enabled: true,  featureFlags: {} },
                { key: "mobilePriceBook",      enabled: true,  featureFlags: {} },
                { key: "mobileTransactions",   enabled: true,  featureFlags: { enableExport: false } },
                { key: "mobileReports",        enabled: false, featureFlags: {} },
                { key: "mobileAnalytics",      enabled: false, featureFlags: {} },
                { key: "mobileSalesTax",       enabled: false, featureFlags: {} }
              ]}
            }
          },
          {
            roleName: "Store Operator", roleId: "store_operator",
            accessKeys: {
              electron: { pages: [
                { key: "pos",            enabled: true,  featureFlags: { enableRefunds: false, enableDiscounts: false, enableVoidTransaction: false } },
                { key: "dashboard",      enabled: true,  featureFlags: {} },
                { key: "products",       enabled: true,  featureFlags: { enableBulkImport: false } },
                { key: "vendors",        enabled: false, featureFlags: {} },
                { key: "vendorPrices",   enabled: false, featureFlags: {} },
                { key: "priceBook",      enabled: false, featureFlags: {} },
                { key: "pricingRules",   enabled: false, featureFlags: {} },
                { key: "costAnalysis",   enabled: false, featureFlags: {} },
                { key: "transactions",   enabled: true,  featureFlags: { enableExport: false } },
                { key: "manageWorker",   enabled: false, featureFlags: {} },
                { key: "userManagement", enabled: false, featureFlags: {} },
                { key: "settings",       enabled: false, featureFlags: {} }
              ]},
              mobile: { pages: [
                { key: "mobilePos",           enabled: true,  featureFlags: { enableManualEntry: false, enableQuickSale: true } },
                { key: "mobileDashboard",      enabled: true,  featureFlags: {} },
                { key: "mobileScanner",        enabled: true,  featureFlags: { enableCameraFlash: false } },
                { key: "mobileProductSearch",  enabled: false, featureFlags: {} },
                { key: "mobileVendorPrices",   enabled: false, featureFlags: {} },
                { key: "mobilePriceBook",      enabled: false, featureFlags: {} },
                { key: "mobileTransactions",   enabled: false, featureFlags: { enableExport: false } },
                { key: "mobileReports",        enabled: false, featureFlags: {} },
                { key: "mobileAnalytics",      enabled: false, featureFlags: {} },
                { key: "mobileSalesTax",       enabled: false, featureFlags: {} }
              ]}
            }
          },
          {
            roleName: "Viewer", roleId: "viewer",
            accessKeys: {
              electron: { pages: [
                { key: "pos",            enabled: false, featureFlags: {} },
                { key: "dashboard",      enabled: true,  featureFlags: {} },
                { key: "products",       enabled: true,  featureFlags: { enableBulkImport: false } },
                { key: "vendors",        enabled: false, featureFlags: {} },
                { key: "vendorPrices",   enabled: false, featureFlags: {} },
                { key: "priceBook",      enabled: false, featureFlags: {} },
                { key: "pricingRules",   enabled: false, featureFlags: {} },
                { key: "costAnalysis",   enabled: false, featureFlags: {} },
                { key: "transactions",   enabled: true,  featureFlags: { enableExport: false } },
                { key: "manageWorker",   enabled: false, featureFlags: {} },
                { key: "userManagement", enabled: false, featureFlags: {} },
                { key: "settings",       enabled: false, featureFlags: {} }
              ]},
              mobile: { pages: [
                { key: "mobilePos",           enabled: false, featureFlags: {} },
                { key: "mobileDashboard",      enabled: true,  featureFlags: {} },
                { key: "mobileScanner",        enabled: false, featureFlags: {} },
                { key: "mobileProductSearch",  enabled: true,  featureFlags: {} },
                { key: "mobileVendorPrices",   enabled: false, featureFlags: {} },
                { key: "mobilePriceBook",      enabled: false, featureFlags: {} },
                { key: "mobileTransactions",   enabled: false, featureFlags: {} },
                { key: "mobileReports",        enabled: false, featureFlags: {} },
                { key: "mobileAnalytics",      enabled: false, featureFlags: {} },
                { key: "mobileSalesTax",       enabled: false, featureFlags: {} }
              ]}
            }
          }
        ]
      }, null, 2);
      setConfigJson(data.store.configJson || defaultJson);
      setLicensePlan(data.store.licensePlan || "trial");
      setTunnelUrl(data.store.tunnelUrl || "");
      
      if (data.store.tunnelUrl) {
        checkTunnelStatus();
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function checkTunnelStatus() {
    setTunnelStatus("checking");
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores/${storeId}/tunnel/status`);
      const data = await res.json();
      setTunnelStatus(data.status || "unknown");
      setTunnelMessage(data.message || "");
    } catch {
      setTunnelStatus("offline");
      setTunnelMessage("Failed to check status");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlan,
          tunnelUrl,
          configJson
        })
      });
      if (res.ok) {
        alert("Store updated successfully");
        loadData();
      } else {
        const err = await res.json();
        alert(`Failed to save: ${err.error || 'Unknown error'}`);
      }
    } catch (err: unknown) {
      console.error(err);
      alert("Error saving store");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateKey() {
    setIsGeneratingKey(true);
    setGeneratedKey(null);
    try {
      const res = await fetch(`/api/v1/admin/setup-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, storeId })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedKey(data.setupKey);
        setKeyExpiresAt(data.expiresAt);
      } else {
        alert(data.error || "Failed to generate key");
      }
    } catch {
      alert("Error generating setup key");
    } finally {
      setIsGeneratingKey(false);
    }
  }

  async function handleDeleteTunnel() {
    if (!confirm("Are you sure you want to delete the Cloudflare Tunnel configuration for this store? This will break the connection to the Edge server.")) return;
    setIsDeletingTunnel(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores/${storeId}/tunnel`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Tunnel configuration deleted");
        setTunnelUrl("");
        loadData();
      } else {
        const err = await res.json();
        alert(`Failed to delete tunnel: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert("Error deleting tunnel");
    } finally {
      setIsDeletingTunnel(false);
    }
  }

  async function handleDeleteStore() {
    if (!confirm("Are you absolutely sure you want to delete this store? This action cannot be undone and will delete all worker installations and keys.")) return;
    setIsDeletingStore(true);
    try {
      const res = await fetch(`/api/v1/admin/organizations/${orgId}/stores/${storeId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        alert("Store deleted");
        window.location.href = `/admin/organizations/${orgId}`;
      } else {
        const err = await res.json();
        alert(`Failed to delete store: ${err.error || 'Unknown error'}`);
      }
    } catch {
      alert("Error deleting store");
    } finally {
      setIsDeletingStore(false);
    }
  }

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--sd-blue)]" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Store not found</h2>
        <Link href={`/admin/organizations/${orgId}`} className="text-[var(--sd-blue)] hover:underline mt-4 inline-block">
          Return to Organization
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link href={`/admin/organizations/${orgId}`} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Organization Details
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{store.name}</h1>
          <p className="text-[var(--muted)] mt-1 font-mono text-sm">{store.storeId}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[var(--sd-blue)] text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Tunnel Settings */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-gray-900">Cloudflare Tunnel</h2>
            </div>
            {store?.tunnelUrl && (
              <button
                onClick={handleDeleteTunnel}
                disabled={isDeletingTunnel}
                className="text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeletingTunnel ? "Deleting..." : "Clear Tunnel Config"}
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tunnel URL</label>
              <input 
                type="text" 
                value={tunnelUrl}
                onChange={e => setTunnelUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] focus:border-transparent outline-none transition-all font-mono text-sm"
                placeholder="https://store-123.storedesk.net"
              />
            </div>
            
            {store?.cloudflareToken && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tunnel Token</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={store.cloudflareToken}
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 font-mono text-xs overflow-hidden text-ellipsis"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(store.cloudflareToken);
                      alert("Token copied to clipboard");
                    }}
                    className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Copy Token"
                  >
                    <Copy className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Use this token to manually run cloudflared on the Edge server if needed.</p>
              </div>
            )}
            
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Connection Status
                  {tunnelStatus === 'checking' && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                </div>
                <div className="text-xs text-gray-500 mt-1">{tunnelMessage || "Status unknown"}</div>
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  tunnelStatus === 'online' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 
                  tunnelStatus === 'offline' ? 'bg-red-50 text-red-700 border border-red-200/60' : 
                  'bg-gray-100 text-gray-700'
                }`}>
                  <Activity className="h-3 w-3" />
                  {tunnelStatus === 'online' ? 'ONLINE' : tunnelStatus === 'offline' ? 'OFFLINE' : 'CHECKING'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Role-Based Page Access Editor */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Role Access & Page Flags</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Each role has its own page access list and per-page feature flags. The app reads the matching role at login and only shows those pages.
          </p>

          {(() => {
            interface PageEntry { key: string; enabled: boolean; featureFlags: Record<string, boolean> }
            interface RoleEntry { roleName: string; roleId: string; accessKeys: { electron: { pages: PageEntry[] }; mobile: { pages: PageEntry[] } } }

            let parsed: Record<string, unknown> = {};
            try { parsed = configJson.trim() ? JSON.parse(configJson) : {}; } catch { }
            const roles = (parsed.roles as RoleEntry[]) || [];

            const PAGE_META: Record<string, { label: string; desc: string; flags: Record<string, string> }> = {
              pos:              { label: "POS Workspace",       desc: "Point-of-sale terminal.",                     flags: { enableRefunds: "Refunds", enableDiscounts: "Discounts", enableVoidTransaction: "Void Txn", enableCashDrawer: "Cash Drawer" } },
              dashboard:        { label: "Dashboard",           desc: "Overview cards and setup checklist.",          flags: {} },
              products:         { label: "Products",            desc: "Product catalog management.",                  flags: { enableBulkImport: "Bulk Import", enableBarcodeGeneration: "Barcode Gen" } },
              vendors:          { label: "Vendors",             desc: "Vendor directory.",                            flags: {} },
              vendorPrices:     { label: "Vendor Prices",       desc: "Manual vendor price entry.",                   flags: {} },
              priceBook:        { label: "Price Book",          desc: "Selling price management.",                    flags: {} },
              pricingRules:     { label: "Pricing Rules",       desc: "Margin/markup and rounding rules.",            flags: {} },
              costAnalysis:     { label: "Cost Analysis",       desc: "Cross-vendor cost comparison.",               flags: {} },
              transactions:     { label: "Transactions",        desc: "Transaction history and reporting.",           flags: { enableExport: "Export CSV", enableRefundView: "Refund View" } },
              manageWorker:     { label: "Manage Worker",       desc: "Edge server status and controls.",             flags: {} },
              userManagement:   { label: "User Management",     desc: "App user roles and sessions.",                 flags: {} },
              settings:         { label: "Settings",            desc: "Store settings and POS config.",               flags: {} },
              mobilePos:           { label: "POS (Mobile)",          desc: "Mobile point-of-sale.",                  flags: { enableManualEntry: "Manual Entry", enableQuickSale: "Quick Sale" } },
              mobileDashboard:     { label: "Dashboard (Mobile)",    desc: "Mobile home screen.",                    flags: {} },
              mobileScanner:       { label: "Barcode Scanner",       desc: "Camera barcode scanner.",                flags: { enableCameraFlash: "Camera Flash", enableManualEntry: "Manual Code" } },
              mobileProductSearch: { label: "Product Search",        desc: "Search products by name/UPC.",           flags: {} },
              mobileVendorPrices:  { label: "Vendor Prices (Mobile)",desc: "View vendor pricing on mobile.",         flags: {} },
              mobilePriceBook:     { label: "Price Book (Mobile)",   desc: "View selling prices on mobile.",         flags: {} },
              mobileTransactions:  { label: "Transactions (Mobile)", desc: "View transaction history.",              flags: { enableExport: "Export CSV" } },
              mobileReports:       { label: "Reports (Mobile)",      desc: "Sales and inventory reports.",           flags: {} },
              mobileAnalytics:     { label: "Analytics (Mobile)",    desc: "Revenue charts and trends.",             flags: {} },
              mobileSalesTax:      { label: "Sales Tax (Mobile)",    desc: "Sales tax management.",                  flags: {} },
            };

            const updateRoles = (newRoles: RoleEntry[]) => {
              try {
                const np: Record<string, unknown> = configJson.trim() ? JSON.parse(configJson) : {};
                np.roles = newRoles;
                setConfigJson(JSON.stringify(np, null, 2));
              } catch { alert("Cannot update while JSON is invalid."); }
            };

            const togglePage = (ri: number, app: "electron" | "mobile", pageKey: string) => {
              const nr = JSON.parse(JSON.stringify(roles)) as RoleEntry[];
              const p = nr[ri].accessKeys[app].pages.find(p => p.key === pageKey);
              if (p) p.enabled = !p.enabled;
              updateRoles(nr);
            };

            const toggleFlag = (ri: number, app: "electron" | "mobile", pageKey: string, fk: string) => {
              const nr = JSON.parse(JSON.stringify(roles)) as RoleEntry[];
              const p = nr[ri].accessKeys[app].pages.find(p => p.key === pageKey);
              if (p) p.featureFlags[fk] = !p.featureFlags[fk];
              updateRoles(nr);
            };

            const renderPlatform = (ri: number, app: "electron" | "mobile", pages: PageEntry[]) => (
              <div className="mb-2">
                <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-3 ${
                  app === "electron" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                }`}>{app === "electron" ? "🖥 Desktop" : "📱 Mobile"}</div>
                <div className="space-y-1.5">
                  {pages.map(page => {
                    const m = PAGE_META[page.key] ?? { label: page.key, desc: "", flags: {} };
                    const fks = Object.keys(m.flags);
                    return (
                      <div key={page.key} className={`rounded-xl border transition-all ${
                        page.enabled ? "bg-white border-gray-200" : "bg-gray-50/60 border-gray-100 opacity-55"
                      }`}>
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <code className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{page.key}</code>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900">{m.label}</div>
                              <div className="text-xs text-gray-400 truncate">{m.desc}</div>
                            </div>
                          </div>
                          <button onClick={() => togglePage(ri, app, page.key)}
                            className={`ml-4 relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                              page.enabled ? "bg-emerald-500" : "bg-gray-200"
                            }`} role="switch" aria-checked={page.enabled}>
                            <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                              page.enabled ? "translate-x-4" : "translate-x-0"
                            }`} />
                          </button>
                        </div>
                        {page.enabled && fks.length > 0 && (
                          <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-gray-50 pt-2">
                            {fks.map(fk => {
                              const on = !!page.featureFlags[fk];
                              return (
                                <button key={fk} onClick={() => toggleFlag(ri, app, page.key, fk)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                    on ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-400"
                                  }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-gray-300"}`} />
                                  {m.flags[fk]}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );

            const ROLE_CHIP: Record<string, string> = {
              org_admin:      "bg-indigo-50 border-indigo-200 text-indigo-700",
              store_manager:  "bg-blue-50 border-blue-200 text-blue-700",
              store_operator: "bg-amber-50 border-amber-200 text-amber-700",
              viewer:         "bg-gray-50 border-gray-200 text-gray-600",
            };

            return (
              <div className="space-y-6">
                {roles.map((role, ri) => (
                  <div key={role.roleId} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        ROLE_CHIP[role.roleId] ?? "bg-gray-50 border-gray-200 text-gray-700"
                      }`}>{role.roleName}</div>
                      <code className="text-[11px] font-mono text-gray-400">{role.roleId}</code>
                    </div>
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {renderPlatform(ri, "electron", role.accessKeys.electron.pages)}
                      {renderPlatform(ri, "mobile",   role.accessKeys.mobile.pages)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Configuration JSON */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Advanced Configuration</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Paste raw JSON configuration overrides for this store. These settings will override global configurations for edge deployments and integrations.
          </p>
          <JsonEditor 
            value={configJson} 
            onChange={setConfigJson} 
            placeholder={'{\n  "posIntegration": "verifone_commander",\n  "posIpAddress": "",\n  "posUsername": "",\n  "posPassword": "",\n  "featureFlags": {}\n}'}
          />
        </div>

        {/* Setup & Activation Panel */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-gray-900">Setup & Activation</h2>
          </div>
          
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-emerald-900">Generate Worker Setup Key</h3>
                <p className="text-sm text-emerald-700/80 mt-1 max-w-md">
                  Issue a one-time 6-digit key for the store owner to activate their physical Edge server.
                  This requires the Cloudflare Tunnel URL to be configured and saved first.
                </p>
              </div>
              
              {!generatedKey ? (
                <button
                  onClick={handleGenerateKey}
                  disabled={!tunnelUrl || isGeneratingKey}
                  className="flex-shrink-0 flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingKey ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><KeyRound className="h-4 w-4" /> Issue Setup Key</>
                  )}
                </button>
              ) : (
                <div className="bg-white border border-emerald-200 rounded-xl p-4 flex-shrink-0 text-center shadow-sm">
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">One-Time Key</div>
                  <div className="text-3xl font-mono font-bold tracking-widest text-gray-900 mb-2">
                    {generatedKey}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-gray-500">
                      Expires: {new Date(keyExpiresAt!).toLocaleTimeString()}
                    </span>
                    <button 
                      onClick={copyToClipboard}
                      className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-md"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {!tunnelUrl && (
              <div className="mt-3 text-xs font-medium text-amber-600 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Tunnel URL is missing. Save the tunnel URL before issuing a key.
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50/50 backdrop-blur-xl rounded-2xl border border-red-200/60 shadow-sm p-6 mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
              <p className="text-sm text-red-700 mt-1">
                Permanently delete this store and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              onClick={handleDeleteStore}
              disabled={isDeletingStore}
              className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 shadow-sm disabled:opacity-50 transition-colors"
            >
              {isDeletingStore ? "Deleting..." : "Delete Store"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
