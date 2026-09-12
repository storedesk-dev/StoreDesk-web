"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type CoverageMode, type License, type NewLicenseInput } from "../../../_lib/api";
import { US_TIME_ZONES, relativeTime, timeZoneLabel } from "../../../_lib/format";
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
import { PcChip, StoreLicenseChip, StoreStatusChip, TunnelChip } from "../../../_components/status";
import { NewLicenseFields, PLAN_LABEL, validNewLicense } from "../../../_components/license";
import type { OrgTabProps } from "./types";

export function StoresTab({ orgId, refreshOrg }: OrgTabProps) {
  const router = useRouter();
  const { data, error, loading, reload } = useLoad(async () => {
    const [stores, licenses] = await Promise.all([api.listStores(orgId), api.listLicenses(orgId)]);
    return { stores: stores.stores, licenses: licenses.licenses };
  }, [orgId]);
  const [creating, setCreating] = useState(false);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const storeHref = (storeId: string) =>
    `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}`;
  const orgLicense = data.licenses.find((l) => l.scope === "organization" && l.status !== "cancelled") ?? null;

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
                <th scope="col" className={table.th}>License</th>
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
                    <Link href={`${storeHref(s.storeId)}?tab=license`} className="hover:opacity-80">
                      <StoreLicenseChip license={s.license} />
                    </Link>
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
        orgLicense={orgLicense}
        onClose={() => setCreating(false)}
        onCreated={(storeId) => {
          refreshOrg();
          router.push(storeHref(storeId));
        }}
      />
    </div>
  );
}

/** Coverage choices for a store, as radio options. Shared with Store · License. */
export function CoverageChoice({
  name,
  mode,
  onMode,
  orgLicense,
  seatFree,
  newLicense,
  onNewLicense,
  ownLicense
}: {
  name: string;
  mode: CoverageMode;
  onMode: (mode: CoverageMode) => void;
  orgLicense: License | null;
  /** False when every seat is used (by other stores). */
  seatFree: boolean;
  newLicense: NewLicenseInput;
  onNewLicense: (value: NewLicenseInput) => void;
  /** The store's existing own license, if any. */
  ownLicense?: License | null;
}) {
  const orgDisabled = !orgLicense || !seatFree;
  const option = (value: CoverageMode, label: React.ReactNode, hint: React.ReactNode, disabled = false) => (
    <label className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${mode === value ? "border-[#1A63F4] bg-[#F3F7FF]" : "border-slate-200"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input
        type="radio"
        name={name}
        className="mt-0.5 h-4 w-4 accent-[#1A63F4]"
        checked={mode === value}
        disabled={disabled}
        onChange={() => onMode(value)}
      />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-[12.5px] text-slate-600">{hint}</span>
      </span>
    </label>
  );
  return (
    <div className="space-y-2" role="radiogroup" aria-label="How this store is licensed">
      {option(
        "organization",
        orgLicense ? (
          <>
            Organization license <span className="font-mono text-[12px] font-normal">{orgLicense.licenseNumber}</span>
          </>
        ) : (
          "Organization license"
        ),
        !orgLicense
          ? "This organization has no organization license."
          : `${orgLicense.seatsUsed} of ${orgLicense.maxStores} seats used${seatFree ? "" : " — no seat free"} · ${PLAN_LABEL[orgLicense.plan] ?? orgLicense.plan}, ${orgLicense.status}`,
        orgDisabled
      )}
      {option(
        "store",
        ownLicense ? (
          <>
            Its own license <span className="font-mono text-[12px] font-normal">{ownLicense.licenseNumber}</span>
          </>
        ) : (
          "Its own store license"
        ),
        ownLicense ? `${PLAN_LABEL[ownLicense.plan] ?? ownLicense.plan}, ${ownLicense.status}` : "A new license that covers only this store."
      )}
      {mode === "store" && !ownLicense ? (
        <div className="ml-6">
          <NewLicenseFields value={newLicense} onChange={onNewLicense} />
        </div>
      ) : null}
      {option("none", "No license yet", "The PC can't activate and sign-in is refused until the store is licensed.")}
    </div>
  );
}

function NewStoreDialog({
  open,
  orgId,
  orgLicense,
  onClose,
  onCreated
}: {
  open: boolean;
  orgId: string;
  orgLicense: License | null;
  onClose: () => void;
  onCreated: (storeId: string) => void;
}) {
  const { toast } = useToast();
  const seatFree = Boolean(orgLicense && orgLicense.seatsUsed < orgLicense.maxStores);
  const [name, setName] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [mode, setMode] = useState<CoverageMode>("organization");
  const [newLicense, setNewLicense] = useState<NewLicenseInput>({ plan: "trial", entitlementDays: 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setStoreNumber("");
    setAddress("");
    setContactEmail("");
    setTimeZone("America/New_York");
    setMode(orgLicense && seatFree ? "organization" : "store");
    setNewLicense({ plan: "trial", entitlementDays: 30 });
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit =
    name.trim().length > 0 &&
    !busy &&
    (mode !== "organization" || (Boolean(orgLicense) && seatFree)) &&
    (mode !== "store" || validNewLicense(newLicense));

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
        license: mode === "store" ? { mode, newLicense } : { mode }
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
        <fieldset className="col-span-2">
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">License</legend>
          <CoverageChoice
            name="new-store-coverage"
            mode={mode}
            onMode={setMode}
            orgLicense={orgLicense}
            seatFree={seatFree}
            newLicense={newLicense}
            onNewLicense={setNewLicense}
          />
        </fieldset>
        {error ? (
          <div className="col-span-2">
            <Notice tone="red">{error}</Notice>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
