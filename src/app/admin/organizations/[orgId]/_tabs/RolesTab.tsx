"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { getPage, type App } from "@/config/pages";
import { api, errorMessage, isConflict, type Role, type RoleAccessKeys, type RolePage, type RoleTemplate } from "../../../_lib/api";
import { plural } from "../../../_lib/format";
import {
  APPS,
  CAPABILITY_LABEL,
  ORG_ADMIN_ROLE_ID,
  ROLE_TEMPLATES,
  countEnabled,
  editorAccessKeys,
  isRetired,
  newAccessItems,
  roleFingerprint,
  templateAccessKeys
} from "../../../_lib/registry";
import {
  Button,
  Chip,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Notice,
  Select,
  Spinner,
  cx,
  useLoad
} from "../../../_components/ui";
import type { OrgTabProps } from "./types";

interface Draft {
  roleName: string;
  accessKeys: RoleAccessKeys;
}

export function RolesTab({ orgId, refreshOrg }: OrgTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [roles, users] = await Promise.all([
      api.listRoles(orgId),
      api.listUsers(orgId).catch(() => null)
    ]);
    return { roles: roles.roles, users: users?.users ?? null };
  }, [orgId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const roles = useMemo(() => data?.roles ?? [], [data]);
  const selected = roles.find((r) => r.roleId === selectedId) ?? roles[0] ?? null;

  useEffect(() => {
    if (!selectedId && roles[0]) setSelectedId(roles[0].roleId);
  }, [roles, selectedId]);

  const userCount = (role: Role) =>
    role.userCount ??
    (data?.users
      ? data.users.filter((u) => u.assignments.some((a) => a.status === "active" && a.role === role.roleId)).length
      : undefined);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;

  const baseDraft = (role: Role): Draft => ({ roleName: role.roleName, accessKeys: editorAccessKeys(role.accessKeys) });
  const draft = selected ? drafts[selected.roleId] ?? baseDraft(selected) : null;
  const dirty =
    selected && draft
      ? roleFingerprint(draft.roleName, draft.accessKeys) !== roleFingerprint(selected.roleName, editorAccessKeys(selected.accessKeys))
      : false;

  function update(next: Draft) {
    if (!selected) return;
    setDrafts((d) => ({ ...d, [selected.roleId]: next }));
  }

  function discard(roleId: string) {
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[roleId];
      return copy;
    });
  }

  async function save(toSave: Draft | null = draft) {
    if (!selected || !toSave) return;
    const draft = toSave;
    if (!draft.roleName.trim()) {
      toast("Give the role a name.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.saveRole(orgId, selected.roleId, {
        baseVersion: selected.version,
        roleName: draft.roleName.trim(),
        accessKeys: draft.accessKeys
      });
      discard(selected.roleId);
      toast(`${draft.roleName.trim()} saved`, "success");
      await reload();
    } catch (e) {
      if (isConflict(e)) {
        discard(selected.roleId);
        toast("Changed elsewhere — reloaded latest", "info");
        await reload();
      } else {
        toast(errorMessage(e, "Couldn't save the role."), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedUsers = selected ? userCount(selected) : undefined;
  const isAdminRole = selected?.roleId === ORG_ADMIN_ROLE_ID;
  const newItems = selected && !isAdminRole ? newAccessItems(selected.accessKeys) : [];

  /** Save the role with the new pages and flags stored as off, so they stop showing as new. */
  function keepNewOff() {
    if (!selected || !draft) return;
    const accessKeys = structuredClone(draft.accessKeys);
    for (const item of newItems) {
      const page = accessKeys[item.app].pages.find((entry) => entry.key === item.pageKey);
      if (!page) continue;
      if (item.flag) page.featureFlags[item.flag] = false;
      else page.enabled = false;
    }
    void save({ ...draft, accessKeys });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Roles decide which pages a user gets on the desktop app and the phone. A store without fuel hides the fuel pages
          whatever the role says — see a store&apos;s Access preview.
        </p>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          New role from template
        </Button>
      </div>

      {roles.length === 0 ? (
        <EmptyState title="No roles yet" action={<Button variant="primary" onClick={() => setCreating(true)}>New role from template</Button>}>
          Start from Organization Admin, Store Manager, Cashier or Viewer and adjust.
        </EmptyState>
      ) : (
        <>
          <div role="tablist" aria-label="Roles" className="flex flex-wrap gap-1.5">
            {roles.map((role) => {
              const active = selected?.roleId === role.roleId;
              const hasDraft = Boolean(drafts[role.roleId]);
              return (
                <button
                  key={role.roleId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(role.roleId)}
                  className={cx(
                    "rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A63F4]",
                    active ? "border-[#1A63F4] bg-[#1A63F4]/10 text-[#0E43D8]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {role.roleName} <span className="font-normal text-slate-500 sd-num">(v{role.version})</span>
                  {role.roleId !== ORG_ADMIN_ROLE_ID && newAccessItems(role.accessKeys).length > 0 ? (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">New pages</span>
                  ) : null}
                  {hasDraft ? <span className="ml-1 text-amber-600" aria-label="unsaved changes">•</span> : null}
                </button>
              );
            })}
          </div>

          {selected && draft ? (
            <section aria-label={`${selected.roleName} role`} className="rounded-lg border border-slate-200 bg-white">
              <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Role name" className="w-64">
                    {(p) => <Input {...p} value={draft.roleName} onChange={(e) => update({ ...draft, roleName: e.target.value })} />}
                  </Field>
                  <p className="pb-2 text-[13px] text-slate-500 sd-num">
                    version {selected.version}
                    {selectedUsers !== undefined ? ` · ${plural(selectedUsers, "user")}` : ""} ·{" "}
                    <span className="font-mono text-[12px]">{selected.roleId}</span>
                  </p>
                </div>
                <Button variant="danger-ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </header>

              {isAdminRole ? (
                <div className="px-4 pt-3">
                  <Notice tone="blue">Always has every page and feature, including pages added later.</Notice>
                </div>
              ) : newItems.length > 0 ? (
                <div className="px-4 pt-3">
                  <Notice tone="amber">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>New pages available</strong>, not given to this role:{" "}
                        {newItems.map((item) => `${item.label} (${item.app === "electron" ? "Desktop" : "Phone"})`).join(", ")}. Turn on
                        the ones it needs and save.
                      </span>
                      <Button variant="ghost" size="sm" disabled={saving} onClick={keepNewOff}>
                        Keep them off
                      </Button>
                    </div>
                  </Notice>
                </div>
              ) : null}

              <div className="grid gap-0 md:grid-cols-2 md:divide-x md:divide-slate-100">
                {APPS.map((app) => (
                  <AppColumn
                    key={app.key}
                    app={app.key}
                    label={app.label}
                    pages={draft.accessKeys[app.key].pages}
                    onChange={(pages) =>
                      update({ ...draft, accessKeys: { ...draft.accessKeys, [app.key]: { pages } } })
                    }
                    enabledCount={countEnabled(draft.accessKeys, app.key)}
                    allLocked={isAdminRole}
                  />
                ))}
              </div>

              <footer className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
                {dirty ? <span className="mr-auto text-[13px] font-semibold text-amber-700">Unsaved changes</span> : null}
                <Button variant="ghost" disabled={!dirty || saving} onClick={() => discard(selected.roleId)}>
                  Discard
                </Button>
                <Button variant="primary" busy={saving} disabled={!dirty} onClick={() => void save()}>
                  Save role
                </Button>
              </footer>
            </section>
          ) : null}
        </>
      )}

      <NewRoleDialog
        open={creating}
        onClose={() => setCreating(false)}
        existingNames={roles.map((r) => r.roleName.toLowerCase())}
        onCreate={async (roleName, template) => {
          const res = await api.createRole(orgId, { roleName, template, accessKeys: templateAccessKeys(template) });
          toast(`${roleName} created`, "success");
          await reload();
          refreshOrg();
          if (res.role?.roleId) setSelectedId(res.role.roleId);
        }}
      />

      {selected ? (
        <ConfirmDialog
          open={deleting}
          onClose={() => setDeleting(false)}
          title={`Delete ${selected.roleName}?`}
          confirmLabel="Delete role"
          destructive
          onConfirm={async () => {
            await api.deleteRole(orgId, selected.roleId);
            discard(selected.roleId);
            setSelectedId(null);
            toast(`${selected.roleName} deleted`, "success");
            await reload();
            refreshOrg();
          }}
        >
          {selectedUsers ? (
            <Notice tone="amber">
              {plural(selectedUsers, "user has", "users have")} this role. Move them to another role on the Users tab
              first — a role that is in use can&apos;t be deleted.
            </Notice>
          ) : (
            <p>Stores stop offering this role at their next sync.</p>
          )}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function AppColumn({
  app,
  label,
  pages,
  onChange,
  enabledCount,
  allLocked = false
}: {
  app: App;
  label: string;
  pages: RolePage[];
  onChange: (pages: RolePage[]) => void;
  enabledCount: number;
  /** Organization Admin: every page and flag is on and can't be changed. */
  allLocked?: boolean;
}) {
  const set = (key: string, patch: Partial<RolePage>) =>
    onChange(pages.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  // A retired page stays in `pages` (saved as stored) but has no toggle.
  const shown = pages.filter((page) => !isRetired(app, page.key));

  return (
    <fieldset className="min-w-0 px-4 py-3">
      <legend className="sr-only">{label} pages</legend>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{label}</h3>
        <span className="text-xs text-slate-500 sd-num">
          {enabledCount} of {shown.length} on
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((page) => {
          const def = getPage(page.key);
          const unknown = !def || def.app !== app;
          const locked = allLocked || Boolean(def?.alwaysEnabled);
          const flags = def ? Object.entries(def.knownFeatureFlags) : [];
          const id = `pg-${app}-${page.key}`;
          return (
            <li key={page.key} className="py-2">
              <div className="flex items-start gap-2.5">
                <input
                  id={id}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#1A63F4] disabled:opacity-60"
                  checked={locked || page.enabled}
                  disabled={locked}
                  onChange={(e) => set(page.key, { enabled: e.target.checked })}
                  aria-describedby={def ? `${id}-desc` : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <label htmlFor={id} className="text-sm font-semibold">
                      {def?.label ?? page.key}
                    </label>
                    {locked && !allLocked ? (
                      <Chip tone="gray">
                        <Lock className="h-3 w-3" aria-hidden /> Always on
                      </Chip>
                    ) : null}
                    {def?.requiresCapability ? <Chip tone="amber">Needs {CAPABILITY_LABEL[def.requiresCapability]}</Chip> : null}
                    {unknown ? <Chip tone="red">Not in registry</Chip> : null}
                  </div>
                  {def ? (
                    <p id={`${id}-desc`} className="text-xs text-slate-500">
                      {def.description}
                    </p>
                  ) : null}
                  {flags.length > 0 && (locked || page.enabled) ? (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {flags.map(([flagKey, flag]) => {
                        const fid = `${id}-${flagKey}`;
                        return (
                          <label key={flagKey} htmlFor={fid} className="flex items-center gap-1.5 text-[12.5px] text-slate-700" title={flag.description}>
                            <input
                              id={fid}
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[#1A63F4]"
                              checked={allLocked || (page.featureFlags[flagKey] ?? flag.default)}
                              disabled={allLocked}
                              onChange={(e) => set(page.key, { featureFlags: { ...page.featureFlags, [flagKey]: e.target.checked } })}
                            />
                            {flag.label}
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function NewRoleDialog({
  open,
  onClose,
  existingNames,
  onCreate
}: {
  open: boolean;
  onClose: () => void;
  existingNames: string[];
  onCreate: (roleName: string, template: RoleTemplate) => Promise<void>;
}) {
  const [template, setTemplate] = useState<RoleTemplate>("store_manager");
  const [name, setName] = useState(ROLE_TEMPLATES.store_manager.label);
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTemplate("store_manager");
    setName(ROLE_TEMPLATES.store_manager.label);
    setNameEdited(false);
    setError(null);
  }, [open]);

  const duplicate = existingNames.includes(name.trim().toLowerCase());
  const canSubmit = name.trim().length > 0 && !duplicate && !busy;
  const preview = templateAccessKeys(template);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), template);
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't create the role."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      title="New role"
      description="Start from a template; every page can be adjusted after."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-role-form" busy={busy} disabled={!canSubmit}>
            Create role
          </Button>
        </>
      }
    >
      <form
        id="new-role-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Template">
          {(p) => (
            <Select
              {...p}
              value={template}
              onChange={(e) => {
                const next = e.target.value as RoleTemplate;
                setTemplate(next);
                if (!nameEdited) setName(next === "blank" ? "" : ROLE_TEMPLATES[next].label);
              }}
            >
              {(Object.keys(ROLE_TEMPLATES) as Array<keyof typeof ROLE_TEMPLATES>).map((key) => (
                <option key={key} value={key}>
                  {ROLE_TEMPLATES[key].label}
                </option>
              ))}
              <option value="blank">Blank — only the always-on pages</option>
            </Select>
          )}
        </Field>
        <p className="text-[13px] text-slate-600">
          {template === "blank" ? "Only Dashboard and Settings; switch on the rest yourself." : ROLE_TEMPLATES[template].description}{" "}
          <span className="text-slate-500 sd-num">
            ({countEnabled(preview, "electron")} desktop pages, {countEnabled(preview, "mobile")} phone pages)
          </span>
        </p>
        <Field label="Role name" error={duplicate ? "A role with this name already exists." : undefined}>
          {(p) => (
            <Input
              {...p}
              required
              value={name}
              onChange={(e) => {
                setNameEdited(true);
                setName(e.target.value);
              }}
            />
          )}
        </Field>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}
