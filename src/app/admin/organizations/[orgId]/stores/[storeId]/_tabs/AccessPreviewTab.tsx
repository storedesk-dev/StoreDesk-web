"use client";

import Link from "next/link";
import { api, type PreviewPage } from "../../../../../_lib/api";
import { APPS, CAPABILITY_LABEL, pageLabel } from "../../../../../_lib/registry";
import { Card, Chip, EmptyState, ErrorBanner, Spinner, useLoad } from "../../../../../_components/ui";
import type { StoreTabProps } from "./shared";

export function AccessPreviewTab({ orgId, storeId }: StoreTabProps) {
  const { data, error, loading, reload } = useLoad(() => api.accessPreview(orgId, storeId), [orgId, storeId]);

  if (error && !data) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const caps = Object.entries(data.capabilities) as Array<[keyof typeof CAPABILITY_LABEL, boolean | null]>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>What each role gets at this store. This store has:</span>
        {caps.map(([cap, on]) => (
          <Chip key={cap} tone={on === true ? "green" : on === false ? "gray" : "amber"} title={on === null ? "Not answered: its pages stay shown" : undefined}>
            {on === false ? "no " : ""}
            {CAPABILITY_LABEL[cap]}
            {on === null ? "?" : ""}
          </Chip>
        ))}
        <Link href="?tab=features" className="font-semibold text-[#0E43D8] hover:underline">
          Change features
        </Link>
      </div>

      {data.roles.length === 0 ? (
        <EmptyState title="No roles">
          Create roles on the organization&apos;s{" "}
          <Link className="font-semibold text-[#0E43D8] hover:underline" href={`/admin/organizations/${encodeURIComponent(orgId)}?tab=roles`}>
            Roles tab
          </Link>
          .
        </EmptyState>
      ) : (
        data.roles.map((role) => (
          <Card key={role.roleId} title={role.roleName} bodyClassName="grid gap-4 md:grid-cols-2">
            {APPS.map((app) => (
              <PageList key={app.key} label={app.label} pages={role[app.key]} />
            ))}
          </Card>
        ))
      )}
    </div>
  );
}

function PageList({ label, pages }: { label: string; pages: PreviewPage[] }) {
  const allowed = pages.filter((p) => !p.hiddenBecause);
  const hidden = pages.filter((p) => p.hiddenBecause);
  return (
    <div>
      <h3 className="mb-1.5 flex items-baseline justify-between text-sm font-bold">
        {label}
        <span className="text-xs font-normal text-slate-500 sd-num">{allowed.length} pages</span>
      </h3>
      {pages.length === 0 ? (
        <p className="text-[13px] text-slate-500">No pages.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {allowed.map((p) => (
            <li key={p.key}>
              <Chip tone="blue">{pageLabel(p.key)}</Chip>
            </li>
          ))}
          {hidden.map((p) => (
            <li key={p.key}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11.5px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-200">
                <span className="line-through">{pageLabel(p.key)}</span>
                <span className="font-medium text-amber-700">hidden: no {CAPABILITY_LABEL[p.hiddenBecause!]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
