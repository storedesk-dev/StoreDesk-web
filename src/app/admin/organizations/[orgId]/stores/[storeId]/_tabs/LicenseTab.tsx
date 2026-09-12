"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type CoverageMode, type NewLicenseInput } from "../../../../../_lib/api";
import { Button, Card, ErrorBanner, Notice, Spinner, useLoad } from "../../../../../_components/ui";
import { StoreLicenseChip } from "../../../../../_components/status";
import { LicenseCard, validNewLicense } from "../../../../../_components/license";
import { CoverageChoice } from "../../../_tabs/StoresTab";
import type { StoreTabProps } from "./shared";

/**
 * Store · License: which license covers the store — the organization license
 * (a seat), its own store license, or none — and its own license's renew,
 * suspend and edit. Switching away from its own license cancels it.
 */
export function LicenseTab({ orgId, storeId, store, refreshStore }: StoreTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.listLicenses(orgId), [orgId]);
  const current: CoverageMode = store.license ? store.license.scope : "none";
  const [mode, setMode] = useState<CoverageMode>(current);
  const [newLicense, setNewLicense] = useState<NewLicenseInput>({ plan: "standard", entitlementDays: 365 });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => setMode(current), [current]);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const orgLicense = data.licenses.find((l) => l.scope === "organization" && l.status !== "cancelled") ?? null;
  const own = data.licenses.find((l) => l.scope === "store" && l.storeId === storeId && l.status !== "cancelled") ?? null;
  const onOrg = Boolean(orgLicense && store.licenseId === orgLicense.licenseId);
  const seatFree = Boolean(orgLicense && (onOrg || orgLicense.seatsUsed < orgLicense.maxStores));
  const changed = mode !== current;
  const cancelsOwn = Boolean(own && changed && mode !== "store");
  const canSave = changed && !busy && (mode !== "store" || Boolean(own) || validNewLicense(newLicense)) && (mode !== "organization" || seatFree);

  const refresh = () => {
    void reload();
    refreshStore();
  };

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setSaveError(null);
    try {
      const res = await api.setStoreLicense(orgId, storeId, mode === "store" && !own ? { mode, newLicense } : { mode });
      toast(
        res.store.license
          ? `${store.name} is now covered by ${res.store.license.licenseNumber}`
          : `${store.name} is now unlicensed`,
        "success"
      );
      refresh();
    } catch (e) {
      setSaveError(errorMessage(e, "Couldn't change the license."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card
        title={
          <span className="flex items-center gap-2">
            Covered by <StoreLicenseChip license={store.license} />
          </span>
        }
        description="A store is covered by the organization license (using a seat), by its own license, or by none."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <CoverageChoice
            name="store-coverage"
            mode={mode}
            onMode={setMode}
            orgLicense={orgLicense}
            seatFree={seatFree}
            newLicense={newLicense}
            onNewLicense={setNewLicense}
            ownLicense={own}
          />
          {cancelsOwn ? (
            <Notice tone="amber">
              Switching away cancels this store&apos;s own license <code className="font-mono">{own!.licenseNumber}</code>.
            </Notice>
          ) : null}
          {mode === "none" && changed ? (
            <Notice tone="red">Without a license the PC can&apos;t activate and sign-in at this store is refused.</Notice>
          ) : null}
          {saveError ? <Notice tone="red">{saveError}</Notice> : null}
          <div className="flex justify-end">
            <Button variant="primary" type="submit" busy={busy} disabled={!canSave}>
              Save coverage
            </Button>
          </div>
        </form>
      </Card>

      {own ? (
        <LicenseCard orgId={orgId} license={own} title="Store license" onChanged={refresh} />
      ) : onOrg && orgLicense ? (
        <LicenseCard orgId={orgId} license={orgLicense} title="Organization license" onChanged={refresh} />
      ) : null}
    </div>
  );
}
