"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { api } from "../../../_lib/api";
import { daysLeftLabel, formatDate, plural } from "../../../_lib/format";
import { Card, CopyButton, DefinitionList, ErrorBanner, Spinner, useLoad } from "../../../_components/ui";
import { OrgStatusChip, PcChip, SubscriptionChip, pcState } from "../../../_components/status";
import type { OrgTabProps } from "./types";

type Goto = (tab: "subscription" | "stores" | "roles" | "users" | "activity") => void;

export function OverviewTab({ orgId, org, goTo }: OrgTabProps & { goTo: Goto }) {
  const { data, error, loading, reload } = useLoad(
    async () => {
      const [subs, stores, roles, users] = await Promise.all([
        api.listSubscriptions(orgId),
        api.listStores(orgId),
        api.listRoles(orgId).catch(() => ({ roles: [] })),
        api.listUsers(orgId).catch(() => ({ users: [] }))
      ]);
      return { subscriptions: subs.subscriptions, stores: stores.stores, roles: roles.roles, users: users.users };
    },
    [orgId]
  );

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const current =
    data.subscriptions.find((s) => s.status === "active" || s.status === "trialing") ?? data.subscriptions[0] ?? null;
  const activePcs = data.stores.filter((s) => ["online", "offline"].includes(pcState(s.installation))).length;

  const steps = [
    { done: Boolean(current && (current.status === "active" || current.status === "trialing")), label: "Subscription in force", tab: "subscription" as const },
    { done: data.stores.length > 0, label: data.stores.length ? `${plural(data.stores.length, "store")}` : "Add the first store", tab: "stores" as const },
    { done: data.roles.length > 0, label: data.roles.length ? `${plural(data.roles.length, "role")}` : "Set up roles", tab: "roles" as const },
    { done: data.users.length > 0, label: data.users.length ? `${plural(data.users.length, "user")}` : "Add users", tab: "users" as const },
    {
      done: data.stores.length > 0 && activePcs === data.stores.length,
      label: `${activePcs} of ${plural(data.stores.length, "store PC")} activated`,
      tab: "stores" as const
    }
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Organization">
        <DefinitionList
          rows={[
            { label: "Name", value: org.name },
            {
              label: "Org tag",
              value: <code className="font-mono text-[13px]">{org.slug}</code>,
              action: <CopyButton value={org.slug} />
            },
            { label: "Status", value: <OrgStatusChip status={org.status} /> },
            { label: "Billing e-mail", value: org.billingEmail || <span className="text-slate-400">—</span> },
            { label: "Created", value: formatDate(org.createdAt) }
          ]}
        />
      </Card>

      <Card
        title="Subscription"
        actions={
          <button type="button" onClick={() => goTo("subscription")} className="text-[13px] font-semibold text-[#0E43D8] hover:underline">
            Manage
          </button>
        }
      >
        {current ? (
          <DefinitionList
            rows={[
              {
                label: "Plan",
                value: (
                  <span className="flex items-center gap-2">
                    <span className="capitalize">{current.plan}</span>
                    <SubscriptionChip status={current.status} />
                  </span>
                )
              },
              {
                label: "Entitlement ends",
                value: (
                  <span className="sd-num">
                    {formatDate(current.entitlementExpiresAt)}{" "}
                    <span className="text-xs text-slate-500">({daysLeftLabel(current.entitlementExpiresAt)})</span>
                  </span>
                )
              },
              {
                label: "Stores",
                value: (
                  <span className="sd-num">
                    {current.storeCount ?? data.stores.filter((s) => s.subscriptionId === current.subscriptionId).length} of {current.maxStores}
                  </span>
                )
              },
              { label: "PCs per store", value: <span className="sd-num">{current.maxWorkerInstallations}</span> }
            ]}
          />
        ) : (
          <p className="py-2 text-sm text-slate-600">
            No subscription yet. Stores can&apos;t be added until there is one.{" "}
            <button type="button" onClick={() => goTo("subscription")} className="font-semibold text-[#0E43D8] hover:underline">
              Add a subscription
            </button>
          </p>
        )}
      </Card>

      <Card title="Setup progress">
        <ol className="space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-[#00A87B]" aria-label="Done" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" aria-label="Not done" />
              )}
              <button type="button" onClick={() => goTo(step.tab)} className="text-left hover:text-[#0E43D8] hover:underline">
                {step.label}
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Stores" actions={<button type="button" onClick={() => goTo("stores")} className="text-[13px] font-semibold text-[#0E43D8] hover:underline">All stores</button>} bodyClassName="p-0">
        {data.stores.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No stores yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.stores.slice(0, 6).map((s) => (
              <li key={s.storeId} className="flex items-center justify-between gap-2 px-4 py-2">
                <Link
                  href={`/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(s.storeId)}`}
                  className="truncate text-sm font-semibold hover:text-[#0E43D8] hover:underline"
                >
                  {s.name}
                  {s.storeNumber ? <span className="font-normal text-slate-500"> · #{s.storeNumber}</span> : null}
                </Link>
                <PcChip installation={s.installation} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
