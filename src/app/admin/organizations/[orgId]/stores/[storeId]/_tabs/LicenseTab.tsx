"use client";

import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type NewLicenseInput } from "../../../../../_lib/api";
import { formatDate, daysLeftLabel } from "../../../../../_lib/format";
import { Button, Card, ErrorBanner, Notice, Spinner, useLoad } from "../../../../../_components/ui";
import { LicenseCard, NewLicenseFields, validNewLicense } from "../../../../../_components/license";
import type { StoreTabProps } from "./shared";

/**
 * Store · License. Master mode: read-only — the master license covers the
 * store and is managed on the organization. Store-wise: the store's own
 * license (renew, suspend, edit, cancel), or Issue one when it has none.
 */
export function LicenseTab({ orgId, storeId, store, refreshStore }: StoreTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.listLicenses(orgId), [orgId]);
  const [newLicense, setNewLicense] = useState<NewLicenseInput>({ plan: "standard", entitlementDays: 365 });
  const [busy, setBusy] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const refresh = () => {
    void reload();
    refreshStore();
  };
  const orgLicensesHref = `/admin/organizations/${encodeURIComponent(orgId)}?tab=licenses`;

  if (data.licensingMode === "master") {
    const master = data.licenses.find((l) => l.scope === "organization" && l.status !== "cancelled") ?? null;
    return (
      <Card title="License">
        {master ? (
          <p className="text-sm">
            Covered by the master license <code className="font-mono font-semibold">{master.licenseNumber}</code> · ends{" "}
            {formatDate(master.entitlementExpiresAt)} ({daysLeftLabel(master.entitlementExpiresAt)}) · managed on the{" "}
            <Link href={orgLicensesHref} className="font-semibold text-[#0E43D8] hover:underline">
              organization
            </Link>
            .
          </p>
        ) : (
          <Notice tone="red">
            The organization is on a master license but has none in force, so this store is Unlicensed. Add one on the{" "}
            <Link href={orgLicensesHref} className="font-semibold underline">
              organization&apos;s Licenses tab
            </Link>
            .
          </Notice>
        )}
      </Card>
    );
  }

  const own = data.licenses.find((l) => l.scope === "store" && l.storeId === storeId && l.status !== "cancelled") ?? null;
  if (own) return <LicenseCard orgId={orgId} license={own} title="Store license" onChanged={refresh} showCovered={false} />;

  async function issue() {
    if (!validNewLicense(newLicense)) return;
    setBusy(true);
    setIssueError(null);
    try {
      const res = await api.upsertStoreLicense(orgId, storeId, newLicense);
      toast(`License ${res.license?.licenseNumber ?? ""} issued to ${store.name}`, "success");
      refresh();
    } catch (e) {
      setIssueError(errorMessage(e, "Couldn't issue the license."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="License" description="This organization is store-wise: each store has its own license.">
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
