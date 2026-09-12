"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastContext";
import {
  api,
  errorMessage,
  type CoverageNote,
  type License,
  type LicensingMode,
  type LicensingModeResult,
  type NewLicenseInput,
  type Store
} from "../../../_lib/api";
import { formatDate } from "../../../_lib/format";
import { Button, Card, Chip, Dialog, EmptyState, ErrorBanner, Notice, Spinner, table, useLoad } from "../../../_components/ui";
import { LicenseStatusChip, StoreLicenseChip } from "../../../_components/status";
import {
  LicenseCard,
  LicenseEnds,
  LicenseFormDialog,
  LicenseRowMenu,
  MODE_LABEL,
  NewLicenseFields,
  PLAN_LABEL,
  validNewLicense
} from "../../../_components/license";
import type { OrgTabProps } from "./types";

/**
 * Organization · Licenses. The licensing mode on top (with Change mode…);
 * master mode: the master license card and the stores it covers; store-wise:
 * a table of stores with each one's license, or Issue license.
 */
export function LicensesTab({ orgId, org, refreshOrg }: OrgTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [licenses, stores] = await Promise.all([api.listLicenses(orgId), api.listStores(orgId)]);
    return { ...licenses, stores: stores.stores };
  }, [orgId]);
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [issuing, setIssuing] = useState<Store | null>(null);
  const [changing, setChanging] = useState(false);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const refresh = () => {
    void reload();
    refreshOrg();
  };
  const storeHref = (storeId: string) =>
    `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}?tab=license`;

  const mode = data.licensingMode;
  const master = data.licenses.find((l) => l.scope === "organization" && l.status !== "cancelled") ?? null;
  const ownLicense = new Map(
    data.licenses.filter((l) => l.scope === "store" && l.status !== "cancelled").map((l) => [l.storeId ?? "", l])
  );
  const cancelled = data.licenses.filter((l) => l.status === "cancelled");
  const unlicensed = data.stores.filter((s) => !s.license);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm">
          <span className="font-semibold text-slate-500">Licensing:</span>{" "}
          <span className="font-semibold text-[#111827]">{MODE_LABEL[mode]}</span>
        </p>
        <Button size="sm" onClick={() => setChanging(true)}>
          Change mode…
        </Button>
      </div>

      {unlicensed.length ? (
        <Notice tone="amber">
          {unlicensed.length === 1 ? "1 store is" : `${unlicensed.length} stores are`} Unlicensed — the PC can&apos;t activate and sign-in
          is refused:{" "}
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

      {mode === "master" ? (
        master ? (
          <>
            <LicenseCard orgId={orgId} license={master} title="Master license" onChanged={refresh} allowCancel={false} showCovered={false} />
            <Card title="Stores" description="The master license covers every store, including stores added later." bodyClassName="p-0">
              {data.stores.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No stores yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.stores.map((s) => (
                    <li key={s.storeId} className="flex items-center justify-between gap-2 px-4 py-2">
                      <Link href={storeHref(s.storeId)} className="text-sm font-semibold hover:text-[#0E43D8] hover:underline">
                        {s.name}
                      </Link>
                      <Chip tone="blue">Covered by master</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title="No master license"
            action={
              <Button variant="primary" onClick={() => setCreatingMaster(true)}>
                Add master license
              </Button>
            }
          >
            {org.name} is on a master license, but has none in force, so every store is Unlicensed. Add one, or change the mode to store-wise.
          </EmptyState>
        )
      ) : (
        <Card title="Stores and their licenses" description="Each store has its own license, or none (Unlicensed)." bodyClassName="p-0">
          {data.stores.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No stores yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={table.table}>
                <caption className="sr-only">Stores and their licenses</caption>
                <thead className={table.thead}>
                  <tr>
                    <th scope="col" className={table.th}>Store</th>
                    <th scope="col" className={table.th}>License</th>
                    <th scope="col" className={table.th}>Plan</th>
                    <th scope="col" className={table.th}>Status</th>
                    <th scope="col" className={table.th}>Ends</th>
                    <th scope="col" className={table.th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.stores.map((s) => {
                    const l = ownLicense.get(s.storeId);
                    return (
                      <tr key={s.storeId} className={table.tr}>
                        <td className={table.td}>
                          <Link href={storeHref(s.storeId)} className="font-semibold hover:text-[#0E43D8] hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        {l ? (
                          <>
                            <td className={`${table.td} font-mono text-[12.5px]`}>{l.licenseNumber}</td>
                            <td className={table.td}>{PLAN_LABEL[l.plan] ?? l.plan}</td>
                            <td className={table.td}>
                              <LicenseStatusChip status={l.status} />
                            </td>
                            <td className={`${table.td} whitespace-nowrap`}>
                              <LicenseEnds license={l} />
                            </td>
                            <td className={`${table.td} text-right`}>
                              <LicenseRowMenu orgId={orgId} license={l} onChanged={refresh} />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={table.td} colSpan={4}>
                              <StoreLicenseChip license={null} />
                            </td>
                            <td className={`${table.td} text-right`}>
                              <Button size="sm" variant="primary" onClick={() => setIssuing(s)}>
                                Issue license
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {cancelled.length ? (
        <details className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">Cancelled licenses ({cancelled.length})</summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {cancelled.map((l) => (
              <li key={l.licenseId}>
                <span className="font-mono text-[12.5px]">{l.licenseNumber}</span> · {l.scope === "organization" ? "master" : (l.storeName ?? "store")} ·{" "}
                {PLAN_LABEL[l.plan] ?? l.plan} · ended {formatDate(l.entitlementExpiresAt)}
                {l.notes ? <span className="text-slate-400"> · {l.notes.split("\n").pop()}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <LicenseFormDialog
        open={creatingMaster}
        mode="master"
        onClose={() => setCreatingMaster(false)}
        onSubmit={async (values) => {
          const res = await api.createLicense(orgId, {
            scope: "organization",
            plan: values.plan,
            entitlementDays: values.entitlementDays,
            maxPcsPerStore: values.maxPcsPerStore,
            offlineGraceDays: values.offlineGraceDays,
            ...(values.notes ? { notes: values.notes } : {})
          });
          toast(`Master license ${res.license.licenseNumber} added`, "success");
          refresh();
        }}
      />
      <LicenseFormDialog
        open={Boolean(issuing)}
        mode="store"
        stores={issuing ? [{ storeId: issuing.storeId, name: issuing.name }] : []}
        onClose={() => setIssuing(null)}
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
          toast(`License ${res.license.licenseNumber} issued to ${res.license.storeName ?? "the store"}`, "success");
          refresh();
        }}
      />
      <ChangeModeDialog
        open={changing}
        orgId={orgId}
        current={mode}
        master={master}
        onClose={() => setChanging(false)}
        onChanged={refresh}
      />
    </div>
  );
}

function coverageText(note: CoverageNote | null): string {
  if (!note) return "Unlicensed";
  const who = note.scope === "organization" ? "Master" : "Own";
  return `${who} ${note.licenseNumber ?? "(new)"} · ${PLAN_LABEL[note.plan] ?? note.plan} · ${note.status} · ends ${formatDate(note.entitlementExpiresAt)}`;
}

/** Choose the other mode, see the dry run per store, then confirm. */
function ChangeModeDialog({
  open,
  orgId,
  current,
  master,
  onClose,
  onChanged
}: {
  open: boolean;
  orgId: string;
  current: LicensingMode;
  master: License | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const target: LicensingMode = current === "master" ? "storeWise" : "master";
  const [copy, setCopy] = useState(true);
  const [terms, setTerms] = useState<NewLicenseInput>({ plan: "standard", entitlementDays: 365, maxPcsPerStore: 1, offlineGraceDays: 7 });
  const [preview, setPreview] = useState<LicensingModeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopy(true);
    setTerms({ plan: "standard", entitlementDays: 365, maxPcsPerStore: 1, offlineGraceDays: 7 });
    setPreview(null);
    setError(null);
  }, [open]);

  const input = () =>
    target === "storeWise" ? { mode: target, copyToStores: copy } : { mode: target, master: terms };
  const termsOk =
    target === "storeWise" ||
    (validNewLicense(terms) &&
      Number.isInteger(Number(terms.maxPcsPerStore)) &&
      Number(terms.maxPcsPerStore) >= 1 &&
      Number.isInteger(Number(terms.offlineGraceDays)) &&
      Number(terms.offlineGraceDays) >= 0 &&
      Number(terms.offlineGraceDays) <= 30);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.changeLicensingMode(orgId, { ...input(), dryRun });
      if (dryRun) {
        setPreview(res);
      } else {
        toast(target === "master" ? "Switched to a master license" : "Switched to store-wise licensing", "success");
        onChanged();
        onClose();
      }
    } catch (e) {
      setError(errorMessage(e, "Couldn't change the licensing mode."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      size="lg"
      title="Change licensing mode"
      description={`Now: ${MODE_LABEL[current]}`}
      footer={
        preview ? (
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
              Back
            </Button>
            <Button variant="primary" busy={busy} onClick={() => void run(false)}>
              Confirm change
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" busy={busy} disabled={!termsOk} onClick={() => void run(true)}>
              Preview
            </Button>
          </>
        )
      }
    >
      {!preview ? (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[13px] font-semibold text-slate-700">Switch to</legend>
            {(["master", "storeWise"] as const).map((m) => (
              <label key={m} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${m === target ? "border-[#1A63F4] bg-[#F3F7FF]" : "border-slate-200 opacity-60"}`}>
                <input type="radio" name="licensing-mode" className="h-4 w-4 accent-[#1A63F4]" checked={m === target} disabled={m !== target} readOnly />
                <span className="font-semibold">{MODE_LABEL[m]}</span>
                {m === current ? <span className="text-xs text-slate-500">(current)</span> : null}
              </label>
            ))}
          </fieldset>
          {target === "storeWise" ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1A63F4]" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
              <span>
                <span className="font-semibold">Copy the master to each store</span>
                <span className="block text-[12.5px] text-slate-600">
                  {master
                    ? `Every store gets its own license with ${master.licenseNumber}'s plan, status, end date, grace and PCs. Unchecked, the stores are Unlicensed until you issue licenses.`
                    : "There is no master license to copy; the stores will be Unlicensed."}
                </span>
              </span>
            </label>
          ) : (
            <div className="space-y-3 rounded-md border border-slate-200 p-3">
              <p className="text-[13px] font-semibold text-slate-700">The new master license</p>
              <NewLicenseFields value={terms} onChange={setTerms} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-slate-700">PCs per store</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="h-9 w-full rounded-md border border-slate-300 px-3"
                    value={String(terms.maxPcsPerStore ?? "")}
                    onChange={(e) => setTerms({ ...terms, maxPcsPerStore: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-semibold text-slate-700">Offline grace (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    className="h-9 w-full rounded-md border border-slate-300 px-3"
                    value={String(terms.offlineGraceDays ?? "")}
                    onChange={(e) => setTerms({ ...terms, offlineGraceDays: Number(e.target.value) })}
                  />
                </label>
              </div>
              <p className="text-[12.5px] text-slate-600">Every store license is cancelled, “superseded by master license”.</p>
            </div>
          )}
          {error ? <Notice tone="red">{error}</Notice> : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {preview.licenses.created.length} license{preview.licenses.created.length === 1 ? "" : "s"} created,{" "}
            {preview.licenses.cancelled.length} cancelled. Nothing has changed yet.
          </p>
          <div className="max-h-80 overflow-auto rounded-md border border-slate-200">
            <table className={table.table}>
              <caption className="sr-only">Effect per store</caption>
              <thead className={table.thead}>
                <tr>
                  <th scope="col" className={table.th}>Store</th>
                  <th scope="col" className={table.th}>Now</th>
                  <th scope="col" className={table.th}>After</th>
                </tr>
              </thead>
              <tbody>
                {preview.stores.map((row) => (
                  <tr key={row.storeId} className={table.tr}>
                    <td className={`${table.td} font-semibold`}>{row.name}</td>
                    <td className={`${table.td} text-[12.5px] ${row.before ? "" : "font-semibold text-red-700"}`}>{coverageText(row.before)}</td>
                    <td className={`${table.td} text-[12.5px] ${row.after ? "" : "font-semibold text-red-700"}`}>{coverageText(row.after)}</td>
                  </tr>
                ))}
                {preview.stores.length === 0 ? (
                  <tr>
                    <td className={`${table.td} text-slate-500`} colSpan={3}>
                      No stores yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {preview.licenses.cancelled.length ? (
            <p className="text-[12.5px] text-slate-600">
              Cancelled: {preview.licenses.cancelled.map((l) => l.licenseNumber).join(", ")}
            </p>
          ) : null}
          {error ? <Notice tone="red">{error}</Notice> : null}
        </div>
      )}
    </Dialog>
  );
}
