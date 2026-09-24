"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type AttentionItem } from "./_lib/api";
import { daysUntil, formatDate, formatShortDateTime, relativeTime } from "./_lib/format";
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner, table, useLoad } from "./_components/ui";
import { ActivityActor, ActivityTarget, actionLabel } from "./_components/activity";
import { sinceTime } from "./_components/status";

const orgHref = (orgId: string, tab?: string) =>
  `/admin/organizations/${encodeURIComponent(orgId)}${tab ? `?tab=${tab}` : ""}`;
const storeHref = (orgId: string, storeId: string, tab?: string) =>
  `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}${tab ? `?tab=${tab}` : ""}`;

function attentionText(item: AttentionItem): string {
  // Shown in the viewer's own time.
  if (item.kind === "tunnel_down") return `Tunnel down since ${sinceTime(item.at)} — phones can't reach this store`;
  if (item.message) return item.message;
  switch (item.kind) {
    case "pc_not_activated":
      return item.at ? `PC not activated (key issued ${relativeTime(item.at)})` : "PC not activated";
    case "license_ending": {
      const days = daysUntil(item.at);
      const which = item.licenseNumber ? `License ${item.licenseNumber}` : "License";
      return days !== null && days < 0 ? `${which} ended ${formatDate(item.at)}` : `${which} ends ${formatDate(item.at)}`;
    }
    case "store_unlicensed":
      return "Unlicensed — the PC can't activate and sign-in is refused";
    case "tunnel_failed":
      return "Tunnel failed — phones can't reach this store";
    case "store_offline":
      return item.at ? `Store PC offline (last seen ${relativeTime(item.at)})` : "Store PC offline";
  }
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.dashboard(), []);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retryTunnel(item: AttentionItem) {
    if (!item.storeId) return;
    setRetrying(item.storeId);
    try {
      const res = await api.retryTunnel(item.storeId);
      toast(
        res.tunnel?.status === "ok" ? `Tunnel ready for ${item.storeName ?? "the store"}` : "Tunnel retry started",
        "success"
      );
      void reload();
    } catch (e) {
      toast(errorMessage(e, "Couldn't retry the tunnel."), "error");
    } finally {
      setRetrying(null);
    }
  }

  const counts = data?.counts;
  const stats = [
    { label: "Organizations", value: counts?.organizations },
    { label: "Stores", value: counts?.stores },
    {
      label: "PCs online",
      value: counts ? (
        <>
          {counts.pcsOnline}
          <span className="text-base font-semibold text-slate-400">/{counts.pcsTotal}</span>
        </>
      ) : undefined
    },
    { label: "Licenses ending in 30 d", value: counts?.licensesEndingSoon, warn: (counts?.licensesEndingSoon ?? 0) > 0 },
    { label: "Unlicensed stores", value: counts?.unlicensedStores, warn: (counts?.unlicensedStores ?? 0) > 0 }
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="What needs you today across every customer." />

      {error ? (
        <ErrorBanner error={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="text-[12.5px] font-semibold text-slate-500">{s.label}</div>
                <div className={`mt-1 text-[26px] font-extrabold tracking-tight sd-num ${s.warn ? "text-amber-700" : "text-[#111827]"}`}>
                  {loading && s.value === undefined ? <span className="text-slate-300">—</span> : s.value ?? 0}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <Card title="Needs attention" description="PCs not activated, licenses ending within 30 days, unlicensed stores, failed tunnels and offline stores." bodyClassName="p-0">
              {loading && !data ? (
                <Spinner />
              ) : !data?.attention.length ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">Nothing needs attention. Every store is set up and online.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.attention.map((item, i) => (
                    <li key={`${item.kind}-${item.storeId ?? item.licenseId ?? item.organizationId}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                      <AlertTriangle
                        className={`h-4 w-4 shrink-0 ${item.kind === "tunnel_failed" || item.kind === "tunnel_down" || item.kind === "store_offline" || item.kind === "store_unlicensed" ? "text-red-500" : "text-amber-500"}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          <Link href={orgHref(item.organizationId)} className="hover:text-[#0E43D8] hover:underline">
                            {item.organizationName}
                          </Link>
                          {item.storeName ? <span className="text-slate-500"> · {item.storeName}</span> : null}
                        </div>
                        <div className="truncate text-[13px] text-slate-600">{attentionText(item)}</div>
                      </div>
                      {item.kind === "license_ending" ? (
                        <Link
                          href={item.storeId ? storeHref(item.organizationId, item.storeId, "license") : orgHref(item.organizationId, "licenses")}
                          className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold hover:bg-slate-50"
                        >
                          Renew
                        </Link>
                      ) : item.kind === "store_unlicensed" && item.storeId ? (
                        <Link
                          href={storeHref(item.organizationId, item.storeId, "license")}
                          className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold hover:bg-slate-50"
                        >
                          License
                        </Link>
                      ) : item.kind === "tunnel_failed" && item.storeId ? (
                        <Button size="sm" busy={retrying === item.storeId} onClick={() => retryTunnel(item)}>
                          Retry
                        </Button>
                      ) : item.storeId ? (
                        <Link
                          href={storeHref(item.organizationId, item.storeId, "pc")}
                          className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Recent activity"
              actions={
                <Link href="/admin/organizations" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0E43D8] hover:underline">
                  Organizations <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
              bodyClassName="p-0"
            >
              {loading && !data ? (
                <Spinner />
              ) : !data?.recentActivity.length ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No activity yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={table.table}>
                    <caption className="sr-only">Recent activity</caption>
                    <thead className={table.thead}>
                      <tr>
                        <th scope="col" className={table.th}>Time</th>
                        <th scope="col" className={table.th}>Who</th>
                        <th scope="col" className={table.th}>What</th>
                        <th scope="col" className={table.th}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentActivity.map((ev) => (
                        <tr key={ev.auditEventId} className={table.tr}>
                          <td className={`${table.td} whitespace-nowrap text-slate-500`}>{formatShortDateTime(ev.occurredAt)}</td>
                          <td className={`${table.td} max-w-[10rem] truncate`}><ActivityActor event={ev} /></td>
                          <td className={`${table.td} whitespace-nowrap`}>{actionLabel(ev.action)}</td>
                          <td className={`${table.td} max-w-[12rem] truncate`}>
                            {ev.organizationId ? (
                              <Link href={orgHref(ev.organizationId, "activity")} className="hover:underline">
                                <ActivityTarget event={ev} withOrg />
                              </Link>
                            ) : (
                              <ActivityTarget event={ev} withOrg />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {!loading && data && data.counts.organizations === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No customers yet"
                action={
                  <Link href="/admin/organizations?new=1" className="inline-flex h-9 items-center rounded-md bg-[#1A63F4] px-3.5 text-sm font-semibold text-white hover:bg-[#0E43D8]">
                    New organization
                  </Link>
                }
              >
                Start with an organization: its name, the org tag phones will type, and its organization license.
              </EmptyState>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
