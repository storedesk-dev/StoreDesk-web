"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type Subscription, type SubscriptionPlan } from "../../../_lib/api";
import { daysLeftLabel, daysUntil, formatDate, plural } from "../../../_lib/format";
import {
  Button,
  Card,
  ConfirmDialog,
  DefinitionList,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Notice,
  Select,
  Spinner,
  useLoad
} from "../../../_components/ui";
import { SubscriptionChip } from "../../../_components/status";
import type { OrgTabProps } from "./types";

const PLAN_LABEL: Record<SubscriptionPlan, string> = { trial: "Trial", standard: "Standard", custom: "Custom" };

export function SubscriptionTab({ orgId, org, refreshOrg }: OrgTabProps) {
  const { data, error, loading, reload } = useLoad(() => api.listSubscriptions(orgId), [orgId]);
  const [creating, setCreating] = useState(false);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  const subs = data?.subscriptions ?? [];

  const refresh = () => {
    void reload();
    refreshOrg();
  };

  return (
    <div className="space-y-5">
      {subs.length === 0 ? (
        <EmptyState
          title="No subscription"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Add subscription
            </Button>
          }
        >
          {org.name} needs a subscription before stores can be added or PCs activated.
        </EmptyState>
      ) : (
        <>
          {subs.map((sub) => (
            <SubscriptionPanel key={sub.subscriptionId} orgId={orgId} orgTag={org.slug} sub={sub} onChanged={refresh} />
          ))}
          <div>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Add another subscription
            </Button>
          </div>
        </>
      )}
      <LimitsDialog
        mode="create"
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (values) => {
          await api.createSubscription(orgId, values);
          refresh();
        }}
      />
    </div>
  );
}

function SubscriptionPanel({
  orgId,
  orgTag,
  sub,
  onChanged
}: {
  orgId: string;
  orgTag: string;
  sub: Subscription;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [renewing, setRenewing] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resuming, setResuming] = useState(false);

  const days = daysUntil(sub.entitlementExpiresAt);
  const inForce = sub.status === "active" || sub.status === "trialing";
  const ended = sub.status === "cancelled";

  async function resume() {
    setResuming(true);
    try {
      await api.updateSubscription(orgId, sub.subscriptionId, { status: sub.plan === "trial" ? "trialing" : "active" });
      toast("Subscription resumed", "success");
      onChanged();
    } catch (e) {
      toast(errorMessage(e, "Couldn't resume the subscription."), "error");
    } finally {
      setResuming(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Subscription <span className="font-semibold text-slate-500">{PLAN_LABEL[sub.plan] ?? sub.plan}</span>
          <SubscriptionChip status={sub.status} />
        </span>
      }
      description={<span className="font-mono text-[11.5px]">{sub.subscriptionId}</span>}
      actions={
        <>
          <Button size="sm" onClick={() => setEditing(true)} disabled={ended}>
            Edit limits
          </Button>
          {!ended ? (
            <Button size="sm" variant="danger-ghost" onClick={() => setCancelling(true)}>
              Cancel subscription
            </Button>
          ) : null}
        </>
      }
    >
      <DefinitionList
        rows={[
          {
            label: "Entitlement ends",
            value: (
              <span className="sd-num">
                {formatDate(sub.entitlementExpiresAt)}{" "}
                <span className={`text-xs ${days !== null && days <= 30 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                  ({daysLeftLabel(sub.entitlementExpiresAt)})
                </span>
              </span>
            ),
            action: !ended ? (
              <Button size="sm" variant="primary" onClick={() => setRenewing(true)}>
                Renew
              </Button>
            ) : undefined
          },
          {
            label: "Status",
            value: <SubscriptionChip status={sub.status} />,
            action: inForce ? (
              <Button size="sm" variant="danger-ghost" onClick={() => setSuspending(true)}>
                Suspend
              </Button>
            ) : sub.status === "suspended" ? (
              <Button size="sm" busy={resuming} onClick={resume}>
                Resume
              </Button>
            ) : undefined
          },
          { label: "Offline grace", value: <span className="sd-num">{plural(sub.offlineGraceDays, "day")}</span> },
          {
            label: "Stores",
            value: (
              <span className="sd-num">
                {sub.storeCount ?? "—"} of {sub.maxStores}
              </span>
            )
          },
          { label: "PCs per store", value: <span className="sd-num">{sub.maxWorkerInstallations}</span> },
          { label: "Started", value: formatDate(sub.startsAt) }
        ]}
      />
      {sub.status === "expired" ? (
        <div className="mt-2">
          <Notice tone="red">The entitlement date has passed. Renew to turn the stores back on.</Notice>
        </div>
      ) : null}

      <RenewDialog
        open={renewing}
        sub={sub}
        onClose={() => setRenewing(false)}
        onRenew={async (renewDays) => {
          const res = await api.updateSubscription(orgId, sub.subscriptionId, { renewDays });
          toast(`Subscription renewed to ${formatDate(res.subscription?.entitlementExpiresAt)}`, "success");
          onChanged();
        }}
      />

      <ConfirmDialog
        open={suspending}
        onClose={() => setSuspending(false)}
        title="Suspend this subscription?"
        confirmLabel="Suspend subscription"
        destructive
        onConfirm={async () => {
          await api.updateSubscription(orgId, sub.subscriptionId, { status: "suspended" });
          toast("Subscription suspended", "success");
          onChanged();
        }}
      >
        <p>
          Stores on this subscription lose their entitlement. Their PCs keep working offline for{" "}
          {plural(sub.offlineGraceDays, "day")}, then stop. New setup keys can&apos;t be issued. Resume at any time.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this subscription?"
        confirmLabel="Cancel subscription"
        destructive
        typeToConfirm={orgTag}
        onConfirm={async () => {
          await api.updateSubscription(orgId, sub.subscriptionId, { status: "cancelled" });
          toast("Subscription cancelled", "success");
          onChanged();
        }}
      >
        <p>
          The stores on it stop being entitled: their PCs stop after the offline grace period and no new keys can be
          issued. A cancelled subscription can&apos;t be renewed — you would add a new one.
        </p>
      </ConfirmDialog>

      <LimitsDialog
        mode="edit"
        sub={sub}
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={async (values) => {
          await api.updateSubscription(orgId, sub.subscriptionId, {
            plan: values.plan,
            maxStores: values.maxStores,
            maxWorkerInstallations: values.maxWorkerInstallations,
            offlineGraceDays: values.offlineGraceDays
          });
          toast("Subscription limits saved", "success");
          onChanged();
        }}
      />
    </Card>
  );
}

function RenewDialog({
  open,
  sub,
  onClose,
  onRenew
}: {
  open: boolean;
  sub: Subscription;
  onClose: () => void;
  onRenew: (days: number) => Promise<void>;
}) {
  const [days, setDays] = useState("365");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDays(sub.plan === "trial" ? "30" : "365");
      setError(null);
    }
  }, [open, sub.plan]);

  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 3650;
  const base = Math.max(Date.now(), new Date(sub.entitlementExpiresAt).getTime() || 0);
  const preview = valid ? formatDate(new Date(base + n * 86_400_000)) : "—";

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onRenew(n);
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't renew."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      size="sm"
      title="Renew subscription"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="renew-form" busy={busy} disabled={!valid}>
            Renew +{valid ? n : "…"} d
          </Button>
        </>
      }
    >
      <form
        id="renew-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Add days" hint={`Ends ${formatDate(sub.entitlementExpiresAt)} today. New end about ${preview}.`}>
          {(p) => <Input {...p} autoFocus type="number" min={1} max={3650} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          {[30, 90, 365].map((d) => (
            <Button key={d} size="sm" onClick={() => setDays(String(d))}>
              +{d} d
            </Button>
          ))}
        </div>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}

interface LimitsValues {
  plan: SubscriptionPlan;
  entitlementDays: number;
  maxStores: number;
  maxWorkerInstallations: number;
  offlineGraceDays: number;
}

function LimitsDialog({
  mode,
  sub,
  open,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  sub?: Subscription;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: LimitsValues) => Promise<void>;
}) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<SubscriptionPlan>("standard");
  const [days, setDays] = useState("365");
  const [maxStores, setMaxStores] = useState("1");
  const [pcs, setPcs] = useState("1");
  const [grace, setGrace] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlan(sub?.plan ?? "standard");
    setDays("365");
    setMaxStores(String(sub?.maxStores ?? 1));
    setPcs(String(sub?.maxWorkerInstallations ?? 1));
    setGrace(String(sub?.offlineGraceDays ?? 7));
    setError(null);
  }, [open, sub]);

  const ints = [maxStores, pcs].map(Number);
  const valid =
    ints.every((v) => Number.isInteger(v) && v >= 1) &&
    Number.isInteger(Number(grace)) &&
    Number(grace) >= 0 &&
    Number(grace) <= 30 &&
    (mode === "edit" || (Number.isInteger(Number(days)) && Number(days) >= 1));
  const belowUsage = mode === "edit" && sub?.storeCount !== undefined && Number(maxStores) < sub.storeCount;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        plan,
        entitlementDays: Number(days),
        maxStores: Number(maxStores),
        maxWorkerInstallations: Number(pcs),
        offlineGraceDays: Number(grace)
      });
      if (mode === "create") toast("Subscription added", "success");
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save the subscription."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title={mode === "create" ? "Add subscription" : "Edit limits"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="limits-form" busy={busy} disabled={!valid}>
            {mode === "create" ? "Add subscription" : "Save limits"}
          </Button>
        </>
      }
    >
      <form
        id="limits-form"
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Plan">
          {(p) => (
            <Select
              {...p}
              value={plan}
              onChange={(e) => {
                const next = e.target.value as SubscriptionPlan;
                setPlan(next);
                if (mode === "create") setDays(next === "trial" ? "30" : "365");
              }}
            >
              <option value="trial">Trial</option>
              <option value="standard">Standard</option>
              <option value="custom">Custom</option>
            </Select>
          )}
        </Field>
        {mode === "create" ? (
          <Field label="Length (days)">
            {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />}
          </Field>
        ) : (
          <div />
        )}
        <Field label="Stores allowed" hint="Counts stores on this subscription.">
          {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={maxStores} onChange={(e) => setMaxStores(e.target.value)} />}
        </Field>
        <Field label="PCs per store">
          {(p) => <Input {...p} type="number" min={1} inputMode="numeric" value={pcs} onChange={(e) => setPcs(e.target.value)} />}
        </Field>
        <Field label="Offline grace (days)" hint="How long a PC keeps working without reaching StoreDesk. 0–30.">
          {(p) => <Input {...p} type="number" min={0} max={30} inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />}
        </Field>
        <div className="col-span-2 space-y-2">
          {belowUsage ? (
            <Notice tone="amber">
              {sub?.storeCount} stores are already on this subscription. Existing stores keep working; no new ones can be added.
            </Notice>
          ) : null}
          {error ? <Notice tone="red">{error}</Notice> : null}
        </div>
      </form>
    </Dialog>
  );
}
