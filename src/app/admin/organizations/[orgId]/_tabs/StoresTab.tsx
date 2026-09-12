"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type Subscription } from "../../../_lib/api";
import { US_TIME_ZONES, formatDate, relativeTime, timeZoneLabel } from "../../../_lib/format";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Notice,
  Select,
  Spinner,
  table,
  useLoad
} from "../../../_components/ui";
import { PcChip, StoreStatusChip, TunnelChip } from "../../../_components/status";
import type { OrgTabProps } from "./types";

export function StoresTab({ orgId, refreshOrg }: OrgTabProps) {
  const router = useRouter();
  const { data, error, loading, reload } = useLoad(async () => {
    const [stores, subs] = await Promise.all([api.listStores(orgId), api.listSubscriptions(orgId)]);
    return { stores: stores.stores, subscriptions: subs.subscriptions };
  }, [orgId]);
  const [creating, setCreating] = useState(false);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const storeHref = (storeId: string) =>
    `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Each store has one PC running StoreDesk and any number of phones.</p>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          New store
        </Button>
      </div>

      {data.stores.length === 0 ? (
        <EmptyState title="No stores yet">
          Add a store, then set up its features, register and PC from the store&apos;s page.
        </EmptyState>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Stores</caption>
            <thead className={table.thead}>
              <tr>
                <th scope="col" className={table.th}>Store</th>
                <th scope="col" className={table.th}>Status</th>
                <th scope="col" className={table.th}>PC</th>
                <th scope="col" className={table.th}>Last seen</th>
                <th scope="col" className={table.th}>Tunnel</th>
                <th scope="col" className={table.th}>Time zone</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.storeId} className={table.tr}>
                  <td className={table.td}>
                    <Link href={storeHref(s.storeId)} className="font-semibold hover:text-[#0E43D8] hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {s.storeNumber ? `#${s.storeNumber}` : null}
                      {s.storeNumber && s.address ? " · " : null}
                      {s.address}
                    </div>
                  </td>
                  <td className={table.td}>
                    <StoreStatusChip status={s.status} />
                  </td>
                  <td className={table.td}>
                    <PcChip installation={s.installation} />
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-slate-600`}>
                    {s.installation?.lastSeenAt ? relativeTime(s.installation.lastSeenAt) : "—"}
                  </td>
                  <td className={table.td}>
                    <TunnelChip tunnel={s.tunnel} />
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-slate-600`}>{timeZoneLabel(s.timeZone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewStoreDialog
        open={creating}
        orgId={orgId}
        subscriptions={data.subscriptions}
        storeCountBySub={Object.fromEntries(
          data.subscriptions.map((sub) => [
            sub.subscriptionId,
            sub.storeCount ?? data.stores.filter((st) => st.subscriptionId === sub.subscriptionId).length
          ])
        )}
        onClose={() => setCreating(false)}
        onCreated={(storeId) => {
          refreshOrg();
          router.push(storeHref(storeId));
        }}
      />
    </div>
  );
}

function NewStoreDialog({
  open,
  orgId,
  subscriptions,
  storeCountBySub,
  onClose,
  onCreated
}: {
  open: boolean;
  orgId: string;
  subscriptions: Subscription[];
  storeCountBySub: Record<string, number>;
  onClose: () => void;
  onCreated: (storeId: string) => void;
}) {
  const { toast } = useToast();
  const usable = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
  const [name, setName] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setStoreNumber("");
    setAddress("");
    setContactEmail("");
    setTimeZone("America/New_York");
    setSubscriptionId(usable[0]?.subscriptionId ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = usable.find((s) => s.subscriptionId === subscriptionId);
  const full = selected ? (storeCountBySub[selected.subscriptionId] ?? 0) >= selected.maxStores : false;
  const canSubmit = name.trim().length > 0 && Boolean(selected) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createStore(orgId, {
        name: name.trim(),
        storeNumber: storeNumber.trim() || undefined,
        address: address.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        timeZone,
        subscriptionId
      });
      toast(`${res.store.name} created`, "success");
      onClose();
      onCreated(res.store.storeId);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create the store."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="New store"
      description="A remote-access tunnel is created with the store. Features, register and PC are set on the store's page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-store-form" busy={busy} disabled={!canSubmit}>
            Create store
          </Button>
        </>
      }
    >
      {usable.length === 0 ? (
        <Notice tone="amber">
          This organization has no active or trial subscription. Add or renew one on the Subscription tab first.
        </Notice>
      ) : (
        <form
          id="new-store-form"
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Store name" className="col-span-2 sm:col-span-1">
            {(p) => <Input {...p} autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Main St" />}
          </Field>
          <Field label="Store number" optional className="col-span-2 sm:col-span-1">
            {(p) => <Input {...p} value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} placeholder="42" />}
          </Field>
          <Field label="Address" optional className="col-span-2">
            {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Atlanta, GA" />}
          </Field>
          <Field label="Store contact e-mail" optional hint="Setup keys can be e-mailed here." className="col-span-2 sm:col-span-1">
            {(p) => <Input {...p} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />}
          </Field>
          <Field label="Time zone" className="col-span-2 sm:col-span-1">
            {(p) => (
              <Select {...p} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                {US_TIME_ZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Subscription" className="col-span-2" error={full ? "This subscription has no store left. Raise its store limit or pick another." : undefined}>
            {(p) => (
              <Select {...p} value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)}>
                {usable.map((s) => (
                  <option key={s.subscriptionId} value={s.subscriptionId}>
                    {s.plan} · ends {formatDate(s.entitlementExpiresAt)} · {storeCountBySub[s.subscriptionId] ?? 0} of {s.maxStores} stores
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {error ? (
            <div className="col-span-2">
              <Notice tone="red">{error}</Notice>
            </div>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
