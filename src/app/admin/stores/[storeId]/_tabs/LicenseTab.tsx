"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type NewLicenseInput } from "../../../_lib/api";
import { Button, Card, ErrorBanner, Notice, Spinner, useLoad } from "../../../_components/ui";
import { LicenseCard, NewLicenseFields, validNewLicense } from "../../../_components/license";
import type { StoreTabProps } from "./shared";

/**
 * Store · License. A licence covers this store and nothing else (D-22), so there is one to show:
 * renew, suspend, edit or cancel it, or issue one when the store has none.
 *
 * The list is still read per organization until S6 moves that route; only this store's own row can
 * match, because a coverage key names one store.
 */
export function LicenseTab({ storeId, store, refreshStore }: StoreTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.listLicenses(store.organizationId), [store.organizationId]);
  const [newLicense, setNewLicense] = useState<NewLicenseInput>({ plan: "standard", entitlementDays: 365 });
  const [busy, setBusy] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;

  const refresh = () => {
    void reload();
    refreshStore();
  };
  const own = data?.licenses.find((l) => l.storeId === storeId && l.status !== "cancelled") ?? null;
  if (own) return <LicenseCard orgId={store.organizationId} license={own} title="License" onChanged={refresh} showCovered={false} />;

  async function issue() {
    if (!validNewLicense(newLicense)) return;
    setBusy(true);
    setIssueError(null);
    try {
      const res = await api.upsertStoreLicense(storeId, newLicense);
      toast(`License ${res.license?.licenseNumber ?? ""} issued to ${store.name}`, "success");
      refresh();
    } catch (e) {
      setIssueError(errorMessage(e, "Couldn't issue the license."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="License" description="Every store has its own license.">
      <form
        className="max-w-lg space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void issue();
        }}
      >
        <Notice tone="red">This store is Unlicensed — its PC can&apos;t activate and sign-in is refused.</Notice>
        <NewLicenseFields value={newLicense} onChange={setNewLicense} />
        {issueError ? <Notice tone="red">{issueError}</Notice> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" busy={busy} disabled={!validNewLicense(newLicense)}>
            Issue license
          </Button>
        </div>
      </form>
    </Card>
  );
}
