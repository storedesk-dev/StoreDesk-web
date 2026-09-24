"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, type Store } from "../_lib/api";
import { relativeTime, timeZoneLabel } from "../_lib/format";
import { EmptyState, ErrorBanner, Input, Spinner, table, useLoad } from "../_components/ui";
import { PcChip, StoreLicenseChip, StoreStatusChip, TunnelChip, pcState } from "../_components/status";

type StoreRow = Store & { organizationName: string | null };

/**
 * Stores — the admin console's front page (D-22).
 *
 * Every store, flat and searchable. There is no organization to drill through any more, so the
 * operator types a name, a number or a business and goes straight to the store. The business name
 * is here to search by and to tell two "Main Street"s apart, not as a grouping; it goes when the
 * entity does (S6).
 */
export default function StoresPage() {
  const { data, error, loading, reload } = useLoad(() => api.listAllStores(), []);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const stores = (data?.stores ?? []) as StoreRow[];
    const needle = query.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((store) =>
      [store.name, store.storeNumber, store.organizationName, store.address]
        .some((field) => String(field ?? "").toLowerCase().includes(needle))
    );
  }, [data, query]);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;

  const stores = (data?.stores ?? []) as StoreRow[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight">Stores</h1>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search stores"
            aria-label="Search stores by name, number or business"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {stores.length === 0 ? (
        <EmptyState title="No stores yet">
          A store is created with its own license, its own people and its own PC.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title={`No store matches “${query}”`}>Try a store number, or the business name.</EmptyState>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Every store</caption>
            <thead className={table.thead}>
              <tr>
                <th scope="col" className={table.th}>Store</th>
                <th scope="col" className={table.th}>Business</th>
                <th scope="col" className={table.th}>License</th>
                <th scope="col" className={table.th}>PC</th>
                <th scope="col" className={table.th}>Remote</th>
                <th scope="col" className={table.th}>Time zone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((store) => {
                const state = pcState(store.installation);
                return (
                  <tr key={store.storeId} className={table.tr}>
                    <td className={table.td}>
                      <Link
                        href={`/admin/stores/${encodeURIComponent(store.storeId)}`}
                        className="font-semibold text-[#0E43D8] hover:underline"
                      >
                        {store.storeNumber ? `Store ${store.storeNumber} · ` : ""}
                        {store.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StoreStatusChip status={store.status} />
                        {store.address ? <span className="truncate text-[12.5px] text-slate-500">{store.address}</span> : null}
                      </div>
                    </td>
                    <td className={table.td}>{store.organizationName ?? "—"}</td>
                    <td className={table.td}><StoreLicenseChip license={store.license} /></td>
                    <td className={table.td}>
                      <PcChip installation={store.installation} />
                      {store.installation?.lastSeenAt && (state === "online" || state === "offline") ? (
                        <div className="sd-num mt-0.5 text-[12.5px] text-slate-500">
                          seen {relativeTime(store.installation.lastSeenAt)}
                        </div>
                      ) : null}
                    </td>
                    <td className={table.td}><TunnelChip tunnel={store.tunnel} /></td>
                    <td className={table.td}>{store.timeZone ? timeZoneLabel(store.timeZone) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
