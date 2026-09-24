"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type Store, type StoreStatus } from "../../../_lib/api";
import { US_TIME_ZONES, formatDate, timeZoneLabel } from "../../../_lib/format";
import {
  Button,
  Card,
  ConfirmDialog,
  DefinitionList,
  Dialog,
  Field,
  Input,
  Notice,
  Select,
  Spinner
} from "../../../_components/ui";
import { StoreLicenseChip, StoreStatusChip } from "../../../_components/status";
import { useStoreSettings, type StoreTabProps } from "./shared";

export function StoreOverviewTab({ storeId, store, refreshStore }: StoreTabProps) {
  const { toast } = useToast();
  const router = useRouter();
  const settings = useStoreSettings(storeId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [timeZone, setTimeZone] = useState<string>("");

  useEffect(() => {
    if (settings.data) setTimeZone(settings.data.settings.timeZone ?? store.timeZone ?? "");
  }, [settings.data, store.timeZone]);

  const savedTz = settings.data?.settings.timeZone ?? store.timeZone ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card
        title="Store details"
        actions={
          <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        }
      >
        <DefinitionList
          rows={[
            { label: "Name", value: store.name },
            { label: "Store number", value: store.storeNumber || <span className="text-slate-400">—</span> },
            { label: "Address", value: store.address || <span className="text-slate-400">—</span> },
            { label: "Contact e-mail", value: store.contactEmail || <span className="text-slate-400">—</span> },
            { label: "Status", value: <StoreStatusChip status={store.status} /> },
            {
              label: "License",
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  <StoreLicenseChip license={store.license} />
                  {store.license ? <span className="font-mono text-[12px] text-slate-500">{store.license.licenseNumber}</span> : null}
                </span>
              )
            },
            { label: "Created", value: formatDate(store.createdAt) },
            { label: "Store id", value: <span className="font-mono text-[12px]">{store.storeId}</span> }
          ]}
        />
      </Card>

      <div className="space-y-5">
        <Card title="Time zone" description="Used for the store's business day and reports.">
          {settings.error ? (
            <Notice tone="red">{errorMessage(settings.error)}</Notice>
          ) : !settings.data ? (
            <Spinner />
          ) : (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void settings.save((s) => ({ ...s, timeZone: timeZone || null }), "Time zone saved");
              }}
            >
              <Field label="Time zone" className="min-w-60 flex-1">
                {(p) => (
                  <Select {...p} value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                    <option value="">Not set</option>
                    {US_TIME_ZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                    {timeZone && !US_TIME_ZONES.some((tz) => tz.value === timeZone) ? (
                      <option value={timeZone}>{timeZoneLabel(timeZone)}</option>
                    ) : null}
                  </Select>
                )}
              </Field>
              <Button type="submit" variant="primary" busy={settings.saving} disabled={timeZone === savedTz}>
                Save
              </Button>
            </form>
          )}
        </Card>

        <Card title="Delete store" className="border-red-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[13px] text-slate-600">
              Revokes the store PC, removes the tunnel and deletes the store&apos;s setup. The data on the store PC stays
              on that PC.
            </p>
            <Button variant="danger-ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(true)}>
              Delete store
            </Button>
          </div>
        </Card>
      </div>

      <EditStoreDialog
        open={editing}
        store={store}
        onClose={() => setEditing(false)}
        onSave={async (patch) => {
          await api.updateStore(storeId, patch);
          toast("Store saved", "success");
          refreshStore();
        }}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${store.name}?`}
        confirmLabel="Delete store"
        destructive
        typeToConfirm={store.name}
        onConfirm={async () => {
          await api.deleteStore(storeId);
          toast(`${store.name} deleted`, "success");
          router.push("/admin/stores");
        }}
      >
        <p>The store PC stops working immediately and phones can no longer reach it. This can&apos;t be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

type StorePatch = Partial<{ name: string; storeNumber: string; address: string; contactEmail: string; status: StoreStatus }>;

function EditStoreDialog({
  open,
  store,
  onClose,
  onSave
}: {
  open: boolean;
  store: Store;
  onClose: () => void;
  onSave: (patch: StorePatch) => Promise<void>;
}) {
  const [name, setName] = useState(store.name);
  const [storeNumber, setStoreNumber] = useState(store.storeNumber ?? "");
  const [address, setAddress] = useState(store.address ?? "");
  const [contactEmail, setContactEmail] = useState(store.contactEmail ?? "");
  const [status, setStatus] = useState<StoreStatus>(store.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(store.name);
    setStoreNumber(store.storeNumber ?? "");
    setAddress(store.address ?? "");
    setContactEmail(store.contactEmail ?? "");
    setStatus(store.status);
    setError(null);
  }, [open, store]);

  async function submit() {
    if (!name.trim()) return;
    const patch: StorePatch = {};
    if (name.trim() !== store.name) patch.name = name.trim();
    if (storeNumber.trim() !== (store.storeNumber ?? "")) patch.storeNumber = storeNumber.trim();
    if (address.trim() !== (store.address ?? "")) patch.address = address.trim();
    if (contactEmail.trim() !== (store.contactEmail ?? "")) patch.contactEmail = contactEmail.trim();
    if (status !== store.status) patch.status = status;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save the store."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="Edit store"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="edit-store-form" busy={busy} disabled={!name.trim()}>Save</Button>
        </>
      }
    >
      <form id="edit-store-form" className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Store name" className="col-span-2 sm:col-span-1">
          {(p) => <Input {...p} required value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Store number" optional className="col-span-2 sm:col-span-1">
          {(p) => <Input {...p} value={storeNumber} onChange={(e) => setStoreNumber(e.target.value)} />}
        </Field>
        <Field label="Address" optional className="col-span-2">
          {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} />}
        </Field>
        <Field label="Store contact e-mail" optional className="col-span-2 sm:col-span-1">
          {(p) => <Input {...p} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />}
        </Field>
        <Field label="Status" className="col-span-2 sm:col-span-1">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as StoreStatus)}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              {store.status === "pending" ? <option value="pending">Pending</option> : null}
              {store.status === "closed" ? <option value="closed">Closed</option> : null}
            </Select>
          )}
        </Field>
        {status === "suspended" && store.status !== "suspended" ? (
          <div className="col-span-2">
            <Notice tone="amber">The store turns sign-in off at its next sync until you set it back to Active.</Notice>
          </div>
        ) : null}
        {error ? <div className="col-span-2"><Notice tone="red">{error}</Notice></div> : null}
      </form>
    </Dialog>
  );
}
