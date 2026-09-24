"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { ApiError, api, errorMessage, type Organization } from "../../_lib/api";
import { orgTagProblem } from "../../_lib/format";
import {
  Button,
  ConfirmDialog,
  CopyButton,
  Dialog,
  ErrorBanner,
  Field,
  Input,
  Notice,
  Select,
  Spinner,
  TabPanel,
  Tabs,
  useLoad
} from "../../_components/ui";
import { OrgStatusChip } from "../../_components/status";
import { OverviewTab } from "./_tabs/OverviewTab";
import { StoresTab } from "./_tabs/StoresTab";
import { UsersTab } from "./_tabs/UsersTab";
import { ActivityTab } from "./_tabs/ActivityTab";

import type { OrgTabProps } from "./_tabs/types";

// Licences live on the store now (D-22), so there is no tab for them here.
type TabKey = "overview" | "stores" | "users" | "activity";
const TAB_KEYS: TabKey[] = ["overview", "stores", "users", "activity"];

export default function OrganizationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrganizationDetail />
    </Suspense>
  );
}

function OrganizationDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const detail = useLoad(() => api.getOrganization(orgId), [orgId]);

  // Old links to the licences tab land on the stores, where each licence now lives.
  const rawTab = search.get("tab");
  const requested = (rawTab === "subscription" || rawTab === "licenses" ? "stores" : rawTab) as TabKey | null;
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : "overview";
  const setTab = (key: TabKey) => router.replace(`${pathname}?tab=${key}`, { scroll: false });

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<"active" | "suspended" | null>(null);

  if (detail.error && !detail.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!detail.data) return <Spinner />;

  const org = detail.data.organization;
  const counts = detail.data.counts;
  const refreshOrg = () => void detail.reload();
  const tabProps: OrgTabProps = { orgId, org, refreshOrg };

  return (
    <div>
      <BackLink />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[22px] font-extrabold tracking-tight">{org.name}</h1>
            <OrgStatusChip status={org.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>
              Org tag <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12.5px] text-[#111827]">{org.slug}</code>
            </span>
            <CopyButton value={org.slug} />
            {org.billingEmail ? <span className="text-slate-400">·</span> : null}
            {org.billingEmail ? <span>Billing {org.billingEmail}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="org-status" className="sr-only">
            Organization status
          </label>
          <Select
            id="org-status"
            className="w-36"
            value={org.status === "suspended" ? "suspended" : "active"}
            onChange={(e) => setStatusTarget(e.target.value as "active" | "suspended")}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Button icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="danger-ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(true)}>
            Delete org
          </Button>
        </div>
      </div>

      <Tabs<TabKey>
        label="Organization sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "stores", label: "Stores", count: counts?.stores },
          { key: "users", label: "Users", count: counts?.users },
          { key: "activity", label: "Activity" }
        ]}
      />
      <TabPanel id={tab}>
        {tab === "overview" ? <OverviewTab {...tabProps} goTo={setTab} /> : null}
        {tab === "stores" ? <StoresTab {...tabProps} /> : null}
        {tab === "users" ? <UsersTab {...tabProps} /> : null}
        {tab === "activity" ? <ActivityTab {...tabProps} /> : null}
      </TabPanel>

      <EditOrganizationDialog
        open={editing}
        org={org}
        onClose={() => setEditing(false)}
        onSaved={(next) => {
          detail.setData({ ...detail.data!, organization: next });
          toast("Organization saved", "success");
        }}
      />

      <ConfirmDialog
        open={statusTarget !== null && statusTarget !== (org.status === "suspended" ? "suspended" : "active")}
        onClose={() => setStatusTarget(null)}
        title={statusTarget === "suspended" ? `Suspend ${org.name}?` : `Resume ${org.name}?`}
        confirmLabel={statusTarget === "suspended" ? "Suspend organization" : "Resume organization"}
        destructive={statusTarget === "suspended"}
        onConfirm={async () => {
          const res = await api.updateOrganization(orgId, { status: statusTarget! });
          detail.setData({ ...detail.data!, organization: res.organization });
          toast(statusTarget === "suspended" ? `${org.name} suspended` : `${org.name} resumed`, "success");
        }}
      >
        {statusTarget === "suspended" ? (
          <>
            <p>
              Phones can no longer find this business by its org tag. Nothing is deleted; resume to turn it back on.
            </p>
            <p className="mt-2 font-semibold">
              Its stores keep running. A store is suspended on its own, from that store&apos;s page.
            </p>
          </>
        ) : (
          <p>Phones can find this business by its org tag again. Its stores were never stopped.</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${org.name}?`}
        confirmLabel="Delete organization"
        destructive
        typeToConfirm={org.slug}
        onConfirm={async () => {
          await api.deleteOrganization(orgId, org.slug);
          toast(`${org.name} deleted`, "success");
          router.push("/admin/organizations");
        }}
      >
        <p>
          This permanently deletes the organization with its licenses, stores, roles and access. Store PCs are
          revoked first and stop working. Users keep their logins but lose access to this organization.
        </p>
        <p className="font-semibold text-red-700">This can&apos;t be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/organizations" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-[#111827]">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Organizations
    </Link>
  );
}

function EditOrganizationDialog({
  open,
  org,
  onClose,
  onSaved
}: {
  open: boolean;
  org: Organization;
  onClose: () => void;
  onSaved: (org: Organization) => void;
}) {
  const [name, setName] = useState(org.name);
  const [tag, setTag] = useState(org.slug);
  const [billingEmail, setBillingEmail] = useState(org.billingEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagTaken, setTagTaken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(org.name);
    setTag(org.slug);
    setBillingEmail(org.billingEmail ?? "");
    setError(null);
    setTagTaken(null);
  }, [open, org]);

  const tagChanged = tag !== org.slug;
  const tagError = tagChanged ? (tagTaken === tag ? "That org tag is already used by another organization." : orgTagProblem(tag)) : null;
  const canSave = name.trim().length > 0 && !tagError && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const patch: Parameters<typeof api.updateOrganization>[1] = {};
      if (name.trim() !== org.name) patch.name = name.trim();
      if (tagChanged) patch.slug = tag;
      if (billingEmail.trim() !== (org.billingEmail ?? "")) patch.billingEmail = billingEmail.trim();
      if (Object.keys(patch).length === 0) {
        onClose();
        return;
      }
      const res = await api.updateOrganization(org.organizationId, patch);
      onSaved(res.organization);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setTagTaken(tag);
      else setError(errorMessage(e, "Couldn't save the organization."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="Edit organization"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-org-form" busy={busy} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="edit-org-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Organization name">{(p) => <Input {...p} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Org tag" hint="Phones type this to find the organization." error={tagError}>
          {(p) => (
            <Input
              {...p}
              className="font-mono"
              spellCheck={false}
              autoCapitalize="none"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          )}
        </Field>
        {tagChanged && !tagError ? (
          <Notice tone="amber">
            Phones set up with <code className="font-mono">{org.slug}</code> will have to enter the new org tag{" "}
            <code className="font-mono">{tag}</code> before they can sign in again. Tell the store before you change it.
          </Notice>
        ) : null}
        <Field label="Billing e-mail" optional>
          {(p) => <Input {...p} type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />}
        </Field>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}
