"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api } from "../../../_lib/api";
import { formatDate } from "../../../_lib/format";
import { Button, Card, EmptyState, ErrorBanner, Notice, Spinner, table, useLoad } from "../../../_components/ui";
import { LicenseStatusChip } from "../../../_components/status";
import { LicenseCard, LicenseEnds, LicenseFormDialog, LicenseRowMenu, PLAN_LABEL } from "../../../_components/license";
import type { OrgTabProps } from "./types";

/**
 * Organization · Licenses: the organization license (seats, covered stores,
 * actions), the store licenses, and the stores with no license.
 */
export function LicensesTab({ orgId, org, refreshOrg }: OrgTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [licenses, stores] = await Promise.all([api.listLicenses(orgId), api.listStores(orgId)]);
    return { licenses: licenses.licenses, stores: stores.stores };
  }, [orgId]);
  const [creating, setCreating] = useState<"organization" | "store" | null>(null);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const refresh = () => {
    void reload();
    refreshOrg();
  };
  const storeHref = (storeId: string) =>
    `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}?tab=license`;

  const orgLicense = data.licenses.find((l) => l.scope === "organization" && l.status !== "cancelled") ?? null;
  const storeLicenses = data.licenses.filter((l) => l.scope === "store" && l.status !== "cancelled");
  const cancelled = data.licenses.filter((l) => l.status === "cancelled");
  const unlicensed = data.stores.filter((s) => !s.license);
  const withoutOwn = data.stores
    .filter((s) => s.license?.scope !== "store")
    .map((s) => ({ storeId: s.storeId, name: s.name, note: s.license ? "now on the organization license" : "unlicensed" }));

  return (
    <div className="space-y-5">
      {unlicensed.length ? (
        <Notice tone="amber">
          {unlicensed.length === 1 ? "1 store has" : `${unlicensed.length} stores have`} no license — its PC can&apos;t activate and
          sign-in is refused:{" "}
          {unlicensed.map((s, i) => (
            <span key={s.storeId}>
              <Link href={storeHref(s.storeId)} className="font-semibold underline">
                {s.name}
              </Link>
              {i < unlicensed.length - 1 ? ", " : ""}
            </span>
          ))}
        </Notice>
      ) : null}

      {orgLicense ? (
        <LicenseCard orgId={orgId} license={orgLicense} title="Organization license" onChanged={refresh} />
      ) : (
        <EmptyState
          title="No organization license"
          action={
            <Button variant="primary" onClick={() => setCreating("organization")}>
              Add organization license
            </Button>
          }
        >
          An organization license covers any of {org.name}&apos;s stores up to its seats. Stores can also have their own license.
        </EmptyState>
      )}

      <Card
        title="Store licenses"
        description="Each covers exactly one store: a single store, or one billed separately."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating("store")} disabled={withoutOwn.length === 0}>
            Store license
          </Button>
        }
        bodyClassName="p-0"
      >
        {storeLicenses.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No store has its own license.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table.table}>
              <caption className="sr-only">Store licenses</caption>
              <thead className={table.thead}>
                <tr>
                  <th scope="col" className={table.th}>License</th>
                  <th scope="col" className={table.th}>Store</th>
                  <th scope="col" className={table.th}>Plan</th>
                  <th scope="col" className={table.th}>Ends</th>
                  <th scope="col" className={`${table.th} text-right`}>PCs</th>
                  <th scope="col" className={table.th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {storeLicenses.map((l) => (
                  <tr key={l.licenseId} className={table.tr}>
                    <td className={`${table.td} font-mono text-[12.5px]`}>{l.licenseNumber}</td>
                    <td className={table.td}>
                      {l.storeId ? (
                        <Link href={storeHref(l.storeId)} className="font-semibold hover:text-[#0E43D8] hover:underline">
                          {l.storeName ?? l.storeId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={table.td}>
                      <span className="mr-2">{PLAN_LABEL[l.plan] ?? l.plan}</span>
                      <LicenseStatusChip status={l.status} />
                    </td>
                    <td className={`${table.td} whitespace-nowrap`}>
                      <LicenseEnds license={l} />
                    </td>
                    <td className={`${table.td} text-right sd-num`}>{l.maxPcsPerStore}</td>
                    <td className={`${table.td} text-right`}>
                      <LicenseRowMenu orgId={orgId} license={l} onChanged={refresh} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cancelled.length ? (
        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">Cancelled licenses ({cancelled.length})</summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {cancelled.map((l) => (
              <li key={l.licenseId}>
                <span className="font-mono text-[12.5px]">{l.licenseNumber}</span> · {l.scope === "organization" ? "organization" : (l.storeName ?? "store")} ·{" "}
                {PLAN_LABEL[l.plan] ?? l.plan} · ended {formatDate(l.entitlementExpiresAt)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <LicenseFormDialog
        open={creating === "organization"}
        mode="organization"
        onClose={() => setCreating(null)}
        onSubmit={async (values) => {
          const res = await api.createLicense(orgId, {
            scope: "organization",
            plan: values.plan,
            entitlementDays: values.entitlementDays,
            maxStores: values.maxStores,
            maxPcsPerStore: values.maxPcsPerStore,
            offlineGraceDays: values.offlineGraceDays,
            ...(values.notes ? { notes: values.notes } : {})
          });
          toast(`Organization license ${res.license.licenseNumber} created`, "success");
          refresh();
        }}
      />
      <LicenseFormDialog
        open={creating === "store"}
        mode="store"
        stores={withoutOwn}
        onClose={() => setCreating(null)}
        onSubmit={async (values) => {
          const res = await api.createLicense(orgId, {
            scope: "store",
            storeId: values.storeId,
            plan: values.plan,
            entitlementDays: values.entitlementDays,
            maxPcsPerStore: values.maxPcsPerStore,
            offlineGraceDays: values.offlineGraceDays,
            ...(values.notes ? { notes: values.notes } : {})
          });
          toast(`Store license ${res.license.licenseNumber} created for ${res.license.storeName ?? "the store"}`, "success");
          refresh();
        }}
      />
    </div>
  );
}
