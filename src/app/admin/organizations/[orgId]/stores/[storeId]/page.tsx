"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Server, ShieldCheck, Activity, KeyRound, Copy, Check } from "lucide-react";
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
      
      setConfigJson(data.store.configJson || "");
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
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">Cloudflare Tunnel</h2>
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
            placeholder={'{\n  "featureFlags": {\n    "enableBetaScanner": true\n  }\n}'}
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

      </div>
    </div>
  );
}
