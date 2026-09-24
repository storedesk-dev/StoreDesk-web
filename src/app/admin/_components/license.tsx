"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type License, type LicensePlan, type NewLicenseInput } from "../_lib/api";
import { daysLeftLabel, daysUntil, formatDate, plural } from "../_lib/format";
import { Button, Card, ConfirmDialog, DefinitionList, Dialog, Field, Input, Notice, Select, Textarea } from "./ui";
import { RowMenu } from "./Menu";
import { LicenseStatusChip } from "./status";

/**
 * Licenses in the admin console (docs/design/control-plane-admin.md,
 * "Licenses"). A license covers one store and nothing else (D-22). These are
 * the dialogs to issue, edit and renew one, and the actions — renew, suspend,
 * resume, cancel — on a store's License tab.
 */

export const PLAN_LABEL: Record<LicensePlan, string> = { trial: "Trial", standard: "Standard", custom: "Custom" };
export const PLAN_DEFAULT_DAYS: Record<LicensePlan, number> = { trial: 30, standard: 365, custom: 365 };
export const inForce = (license: { status: string } | null | undefined) =>
  license?.status === "active" || license?.status === "trialing";

const storeHref = (orgId: string, storeId: string, tab?: string) =>
  `/admin/organizations/${encodeURIComponent(orgId)}/stores/${encodeURIComponent(storeId)}${tab ? `?tab=${tab}` : ""}`;

export function LicenseEnds({ license }: { license: { entitlementExpiresAt: string | null } }) {
  const days = daysUntil(license.entitlementExpiresAt);
  return (
    <span className="sd-num">
      {formatDate(license.entitlementExpiresAt)}{" "}
      <span className={`text-xs ${days !== null && days <= 30 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
        ({daysLeftLabel(license.entitlementExpiresAt)})
      </span>
    </span>
  );
}

// ── Create / edit ────────────────────────────────────────────────────────────

export interface LicenseFormValues {
  plan: LicensePlan;
  entitlementDays: number;
  maxPcsPerStore: number;
  offlineGraceDays: number;
  notes: string;
  storeId: string;
}

/** Plan and length for a new license, inline in a form (New store, Store · License, Change mode). */
export function NewLicenseFields({ value, onChange }: { value: NewLicenseInput; onChange: (next: NewLicenseInput) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Plan">
        {(p) => (
          <Select
            {...p}
            value={value.plan}
            onChange={(e) => {
              const plan = e.target.value as LicensePlan;
              onChange({ ...value, plan, entitlementDays: PLAN_DEFAULT_DAYS[plan] });
            }}
          >
            <option value="trial">Trial</option>
            <option value="standard">Standard</option>
            <option value="custom">Custom</option>
          </Select>
        )}
      </Field>
      <Field label="Length (days)">
        {(p) => (
          <Input
            {...p}
            type="number"
            min={1}
            max={3650}
            inputMode="numeric"
            value={String(value.entitlementDays ?? "")}
            onChange={(e) => onChange({ ...value, entitlementDays: Number(e.target.value) })}
          />
        )}
      </Field>
    </div>
  );
}

export function validNewLicense(value: NewLicenseInput): boolean {
  const days = Number(value.entitlementDays);
  return Number.isInteger(days) && days >= 1 && days <= 3650;
}

/** Issue a store's license (pick the store), or edit one: plan, PCs per store, grace, notes. */
export function LicenseFormDialog({
  open,
  mode,
  license,
  stores = [],
  onClose,
  onSubmit
}: {
  open: boolean;
  mode: "store" | "edit";
  license?: License;
  /** For `store`: the stores that can be issued a license. */
  stores?: Array<{ storeId: string; name: string }>;
  onClose: () => void;
  onSubmit: (values: LicenseFormValues) => Promise<void>;
}) {
  const [plan, setPlan] = useState<LicensePlan>("standard");
  const [days, setDays] = useState("365");
  const [pcs, setPcs] = useState("1");
  const [grace, setGrace] = useState("7");
  const [notes, setNotes] = useState("");
  const [storeId, setStoreId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlan(license?.plan ?? "standard");
    setDays("365");
    setPcs(String(license?.maxPcsPerStore ?? 1));
    setGrace(String(license?.offlineGraceDays ?? 7));
    setNotes(license?.notes ?? "");
    setStoreId(stores[0]?.storeId ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, license, mode]);

  const int = (v: string, min: number, max: number) => Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;
  const valid = int(pcs, 1, 50) && int(grace, 0, 30) && (mode === "edit" || int(days, 1, 3650)) && (mode !== "store" || Boolean(storeId));

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        plan,
        entitlementDays: Number(days),
        maxPcsPerStore: Number(pcs),
        offlineGraceDays: Number(grace),
        notes: notes.trim(),
        storeId
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save the license."));
    } finally {
      setBusy(false);
    }
  }

  const single = mode === "store" && stores.length === 1 ? stores[0] : null;
  const title =
    mode === "store"
      ? single
        ? `Issue a license to ${single.name}`
        : "Issue a store license"
      : `Edit ${license?.licenseNumber ?? "license"}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title={title}
      description={mode === "store" ? "Covers exactly this one store." : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="license-form" busy={busy} disabled={!valid}>
            {mode === "edit" ? "Save" : "Issue license"}
          </Button>
        </>
      }
    >
      <form
        id="license-form"
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === "store" && !single ? (
          <Field label="Store" className="col-span-2">
            {(p) =>
              stores.length ? (
                <Select {...p} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                  {stores.map((s) => (
                    <option key={s.storeId} value={s.storeId}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm text-slate-600">Every store already has its license.</p>
              )
            }
          </Field>
        ) : null}
        <Field label="Plan">
          {(p) => (
            <Select
              {...p}
              value={plan}
              onChange={(e) => {
                const next = e.target.value as LicensePlan;
                setPlan(next);
                if (mode !== "edit") setDays(String(PLAN_DEFAULT_DAYS[next]));
              }}
            >
              <option value="trial">Trial</option>
              <option value="standard">Standard</option>
              <option value="custom">Custom</option>
            </Select>
          )}
        </Field>
        {mode !== "edit" ? (
          <Field label="Length (days)">
            {(p) => <Input {...p} type="number" min={1} max={3650} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />}
          </Field>
        ) : (
          <div />
        )}
        <Field label="PCs per store">
          {(p) => <Input {...p} type="number" min={1} max={50} inputMode="numeric" value={pcs} onChange={(e) => setPcs(e.target.value)} />}
        </Field>
        <Field label="Offline grace (days)" hint="How long a PC keeps working without reaching StoreDesk. 0–30.">
          {(p) => <Input {...p} type="number" min={0} max={30} inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value)} />}
        </Field>
        <Field label="Notes" optional className="col-span-2">
          {(p) => <Textarea {...p} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        {error ? (
          <div className="col-span-2">
            <Notice tone="red">{error}</Notice>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

function RenewDialog({
  open,
  license,
  onClose,
  onRenew
}: {
  open: boolean;
  license: License;
  onClose: () => void;
  onRenew: (days: number) => Promise<void>;
}) {
  const [days, setDays] = useState("365");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDays("365");
      setError(null);
    }
  }, [open]);

  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 3650;
  const base = Math.max(Date.now(), new Date(license.entitlementExpiresAt ?? 0).getTime() || 0);
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
      title={`Renew ${license.licenseNumber}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="renew-license-form" busy={busy} disabled={!valid}>
            Renew +{valid ? n : "…"} d
          </Button>
        </>
      }
    >
      <form
        id="renew-license-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Add days" hint={`Ends ${formatDate(license.entitlementExpiresAt)} today. New end about ${preview}.`}>
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

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Renew, edit, suspend, resume and cancel for one license: the handlers and
 * the dialogs they open. `dialogs` must be rendered once.
 */
export function useLicenseActions(orgId: string, license: License, onChanged: () => void) {
  const { toast } = useToast();
  const [open, setOpen] = useState<"renew" | "edit" | "suspend" | "cancel" | null>(null);
  const [resuming, setResuming] = useState(false);
  const close = () => setOpen(null);
  const count = license.coveredStores.length;
  const covers =
    license.scope === "organization" ? `Every store (${plural(count, "store")})` : license.storeName ?? "Its store";
  const verb = (singular: string, many: string) => (license.scope === "organization" && count !== 1 ? many : singular);

  async function resume() {
    setResuming(true);
    try {
      await api.updateLicense(orgId, license.licenseId, { status: license.plan === "trial" ? "trialing" : "active" });
      toast(`${license.licenseNumber} resumed`, "success");
      onChanged();
    } catch (e) {
      toast(errorMessage(e, "Couldn't resume the license."), "error");
    } finally {
      setResuming(false);
    }
  }

  const dialogs: ReactNode = (
    <>
      <RenewDialog
        open={open === "renew"}
        license={license}
        onClose={close}
        onRenew={async (renewDays) => {
          const res = await api.updateLicense(orgId, license.licenseId, { renewDays });
          toast(`${license.licenseNumber} renewed to ${formatDate(res.license.entitlementExpiresAt)}`, "success");
          onChanged();
        }}
      />
      <LicenseFormDialog
        open={open === "edit"}
        mode="edit"
        license={license}
        onClose={close}
        onSubmit={async (values) => {
          await api.updateLicense(orgId, license.licenseId, {
            plan: values.plan,
            maxPcsPerStore: values.maxPcsPerStore,
            offlineGraceDays: values.offlineGraceDays,
            notes: values.notes || null
          });
          toast(`${license.licenseNumber} saved`, "success");
          onChanged();
        }}
      />
      <ConfirmDialog
        open={open === "suspend"}
        onClose={close}
        title={`Suspend ${license.licenseNumber}?`}
        confirmLabel="Suspend license"
        destructive
        onConfirm={async () => {
          await api.updateLicense(orgId, license.licenseId, { status: "suspended" });
          toast(`${license.licenseNumber} suspended`, "success");
          onChanged();
        }}
      >
        <p>
          {covers} {verb("loses", "lose")} the license. PCs keep working offline for {plural(license.offlineGraceDays, "day")}, then stop,
          and no new setup keys can be issued. Resume at any time.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={open === "cancel"}
        onClose={close}
        title={`Cancel ${license.licenseNumber}?`}
        confirmLabel="Cancel license"
        destructive
        typeToConfirm={license.licenseNumber}
        onConfirm={async () => {
          await api.updateLicense(orgId, license.licenseId, { status: "cancelled" });
          toast(`${license.licenseNumber} cancelled`, "success");
          onChanged();
        }}
      >
        <p>
          {covers} {verb("becomes", "become")} Unlicensed: PCs can&apos;t activate and sign-in is refused. A cancelled license can&apos;t be
          renewed — you would issue a new one.
        </p>
      </ConfirmDialog>
    </>
  );

  return {
    renew: () => setOpen("renew"),
    edit: () => setOpen("edit"),
    suspend: () => setOpen("suspend"),
    cancel: () => setOpen("cancel"),
    resume,
    resuming,
    dialogs
  };
}

/** A license as a card: number, plan and status, end and days left, grace, PCs per store, what it covers. */
export function LicenseCard({
  orgId,
  license,
  title,
  onChanged,
  allowCancel = true,
  showCovered = true
}: {
  orgId: string;
  license: License;
  title: string;
  onChanged: () => void;
  /** A cancelled license is final, so the card asks before it offers this. */
  allowCancel?: boolean;
  showCovered?: boolean;
}) {
  const actions = useLicenseActions(orgId, license, onChanged);
  const cancelled = license.status === "cancelled";
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {title}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12.5px] text-[#111827]">{license.licenseNumber}</code>
          <span className="font-semibold text-slate-500">{PLAN_LABEL[license.plan] ?? license.plan}</span>
          <LicenseStatusChip status={license.status} />
        </span>
      }
      actions={
        !cancelled ? (
          <>
            <Button size="sm" variant="primary" onClick={actions.renew}>
              Renew +365 d
            </Button>
            {inForce(license) ? (
              <Button size="sm" variant="danger-ghost" onClick={actions.suspend}>
                Suspend
              </Button>
            ) : license.status === "suspended" ? (
              <Button size="sm" busy={actions.resuming} onClick={actions.resume}>
                Resume
              </Button>
            ) : null}
            <Button size="sm" onClick={actions.edit}>
              Edit
            </Button>
            {allowCancel ? (
              <Button size="sm" variant="danger-ghost" onClick={actions.cancel}>
                Cancel license
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <DefinitionList
        rows={[
          { label: "Ends", value: <LicenseEnds license={license} /> },
          { label: "Status", value: <LicenseStatusChip status={license.status} /> },
          { label: "Offline grace", value: <span className="sd-num">{plural(license.offlineGraceDays, "day")}</span> },
          { label: "PCs per store", value: <span className="sd-num">{license.maxPcsPerStore}</span> },
          ...(showCovered
            ? [
                {
                  label: license.scope === "organization" ? "Covers" : "Store",
                  value: license.coveredStores.length ? (
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {license.scope === "organization" ? <span className="text-slate-500">Every store:</span> : null}
                      {license.coveredStores.map((s, i) => (
                        <span key={s.storeId}>
                          <Link href={storeHref(orgId, s.storeId, "license")} className="font-semibold hover:text-[#0E43D8] hover:underline">
                            {s.name}
                          </Link>
                          {i < license.coveredStores.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-slate-400">{license.scope === "organization" ? "Every store (none yet)" : "—"}</span>
                  )
                }
              ]
            : []),
          ...(license.notes ? [{ label: "Notes", value: <span className="whitespace-pre-line">{license.notes}</span> }] : [])
        ]}
      />
      {license.status === "expired" ? (
        <div className="mt-2">
          <Notice tone="red">The end date has passed. Renew to turn the stores back on.</Notice>
        </div>
      ) : null}
      {actions.dialogs}
    </Card>
  );
}

/** The row menu for a store license in a table. */
export function LicenseRowMenu({ orgId, license, onChanged }: { orgId: string; license: License; onChanged: () => void }) {
  const actions = useLicenseActions(orgId, license, onChanged);
  if (license.status === "cancelled") return null;
  return (
    <>
      <RowMenu
        label={`Actions for ${license.licenseNumber}`}
        items={[
          { label: "Renew", onSelect: actions.renew },
          { label: "Edit", onSelect: actions.edit },
          { label: "Suspend", onSelect: actions.suspend, hidden: !inForce(license) },
          { label: "Resume", onSelect: () => void actions.resume(), hidden: license.status !== "suspended" },
          { label: "Cancel license", onSelect: actions.cancel, danger: true }
        ]}
      />
      {actions.dialogs}
    </>
  );
}
