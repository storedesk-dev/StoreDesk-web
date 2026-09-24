"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { ApiError, api } from "../_lib/api";
import { daysLeftLabel, daysUntil, formatDate, orgTagProblem, suggestOrgTag } from "../_lib/format";
import {
  Button,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Notice,
  PageHeader,
  Spinner,
  table,
  useLoad
} from "../_components/ui";
import { OrgStatusChip } from "../_components/status";

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrganizationsList />
    </Suspense>
  );
}

function OrganizationsList() {
  const search = useSearchParams();
  const router = useRouter();
  const { data, error, loading, reload } = useLoad(() => api.listOrganizations(), []);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (search.get("new") === "1") setCreating(true);
  }, [search]);

  const rows = useMemo(() => {
    const all = data?.organizations ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Every customer, their licenses and their stores."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New organization
          </Button>
        }
      />

      <div className="mb-3 flex items-center gap-3">
        <div className="relative w-full max-w-xs">
          <label htmlFor="org-filter" className="sr-only">
            Filter by name or org tag
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input id="org-filter" type="search" placeholder="Filter by name or org tag" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {data ? (
          <span className="text-[13px] text-slate-500 sd-num">
            {rows.length} of {data.organizations.length}
          </span>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.organizations.length ? (
        <EmptyState
          title="No organizations yet"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              New organization
            </Button>
          }
        >
          An organization is one customer. It holds the licenses, the stores, the roles and the users.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title={`No organization matches “${query.trim()}”`} />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Organizations</caption>
            <thead className={table.thead}>
              <tr>
                <th scope="col" className={table.th}>Name</th>
                <th scope="col" className={table.th}>Org tag</th>
                <th scope="col" className={table.th}>Status</th>
                <th scope="col" className={table.th}>Licensing</th>
                <th scope="col" className={`${table.th} text-right`}>Stores</th>
                <th scope="col" className={table.th}>License ends</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => {
                const days = daysUntil(org.license?.entitlementExpiresAt);
                return (
                  <tr key={org.organizationId} className={table.tr}>
                    <td className={table.td}>
                      <Link
                        href={`/admin/organizations/${encodeURIComponent(org.organizationId)}`}
                        className="font-semibold text-[#111827] hover:text-[#0E43D8] hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className={`${table.td} font-mono text-[12.5px] text-slate-600`}>{org.slug}</td>
                    <td className={table.td}>
                      <OrgStatusChip status={org.status} />
                    </td>
                    <td className={table.td}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold sd-num">
                          {org.storeLicenseCount} licensed
                        </span>
                        {org.unlicensedStoreCount ? (
                          <span className="sd-num text-xs font-semibold text-red-700">
                            {org.unlicensedStoreCount} unlicensed
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={`${table.td} text-right`}>
                      {org.storeCount ?? 0}
                      {org.unlicensedStoreCount ? (
                        <div className="text-[11.5px] font-semibold text-red-700">{org.unlicensedStoreCount} unlicensed</div>
                      ) : null}
                    </td>
                    <td className={`${table.td} whitespace-nowrap`}>
                      {org.license?.entitlementExpiresAt ? (
                        <>
                          {formatDate(org.license.entitlementExpiresAt)}{" "}
                          <span className={`text-xs ${days !== null && days <= 30 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                            ({daysLeftLabel(org.license.entitlementExpiresAt)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NewOrganizationDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          if (search.get("new")) router.replace("/admin/organizations");
        }}
        onCreated={(orgId) => router.push(`/admin/organizations/${encodeURIComponent(orgId)}`)}
      />
    </div>
  );
}

function NewOrganizationDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (orgId: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [tagEdited, setTagEdited] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagTaken, setTagTaken] = useState<string | null>(null);
  const [touchedTag, setTouchedTag] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setTag("");
    setTagEdited(false);
    setBillingEmail("");
    setError(null);
    setTagTaken(null);
    setTouchedTag(false);
  }, [open]);

  const effectiveTag = tagEdited ? tag : suggestOrgTag(name);
  const tagError = tagTaken === effectiveTag ? "That org tag is already used by another organization." : orgTagProblem(effectiveTag);
  const canSubmit = name.trim().length > 0 && !tagError && !busy;

  async function submit() {
    if (!canSubmit) {
      setTouchedTag(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.createOrganization({
        name: name.trim(),
        slug: effectiveTag,
        billingEmail: billingEmail.trim() || undefined
      });
      toast(`${res.organization.name} created`, "success");
      onClose();
      onCreated(res.organization.organizationId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setTagTaken(effectiveTag);
        setTouchedTag(true);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't create the organization.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="New organization"
      description="One customer. Stores, roles and users are added on the next screen."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-org-form" busy={busy} disabled={!canSubmit}>
            Create organization
          </Button>
        </>
      }
    >
      <form
        id="new-org-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Organization name">
          {(p) => <Input {...p} autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Example Retail" />}
        </Field>
        <Field
          label="Org tag"
          hint={
            <>
              Phones will type this to find the organization. Lower-case letters, numbers and hyphens; up to 40.
            </>
          }
          error={touchedTag || tagEdited || name ? (effectiveTag || touchedTag ? tagError : null) : null}
        >
          {(p) => (
            <Input
              {...p}
              required
              spellCheck={false}
              autoCapitalize="none"
              className="font-mono"
              value={effectiveTag}
              onChange={(e) => {
                setTagEdited(true);
                setTag(e.target.value);
              }}
              onBlur={() => setTouchedTag(true)}
              placeholder="example-retail"
            />
          )}
        </Field>
        <Field label="Billing e-mail" optional>
          {(p) => (
            <Input {...p} type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="accounts@example.com" />
          )}
        </Field>

        <p className="text-xs text-slate-500">
          A license covers one store, so each store gets its own when you add it (D-22).
        </p>
        {error ? <Notice tone="red">{error}</Notice> : null}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
