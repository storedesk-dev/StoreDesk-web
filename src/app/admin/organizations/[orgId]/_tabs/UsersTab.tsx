"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Plus, Trash2, Wand2 } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import {
  api,
  errorMessage,
  type AddUserResult,
  type AppUser,
  type Assignment,
  type Invitation,
  type Role,
  type Store
} from "../../../_lib/api";
import { formatDateTime, generatePassword, relativeTime } from "../../../_lib/format";
import {
  Button,
  Chip,
  ConfirmDialog,
  CopyButton,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Notice,
  SecretBox,
  Select,
  Spinner,
  table,
  useLoad,
  type FieldControlProps
} from "../../../_components/ui";
import { RowMenu } from "../../../_components/Menu";
import type { OrgTabProps } from "./types";

const WHOLE_ORG = "";
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function signInLabel(u: AppUser): { label: string; tone: "amber" | "blue" | "green" } {
  if (u.status === "pending_enrollment") return { label: "Invited", tone: "amber" };
  if (u.loginType === "managed" || u.passwordSetBy === "admin") return { label: "Password set by admin", tone: "blue" };
  return { label: "Active", tone: "green" };
}

function enrollUrl(): string {
  return typeof window === "undefined" ? "/enroll" : `${window.location.origin}/enroll`;
}

type Action =
  | { kind: "assignments"; user: AppUser }
  | { kind: "add-store"; user: AppUser }
  | { kind: "password"; user: AppUser }
  | { kind: "invite"; user: AppUser; invitation: Invitation }
  | { kind: "disable"; user: AppUser }
  | { kind: "revoke"; user: AppUser };

export function UsersTab({ orgId, org, refreshOrg }: OrgTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [users, stores, roles] = await Promise.all([api.listUsers(orgId), api.listStores(orgId), api.listRoles(orgId)]);
    return { users: users.users, stores: stores.stores, roles: roles.roles };
  }, [orgId]);
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const storeName = useMemo(() => {
    const map = new Map((data?.stores ?? []).map((s) => [s.storeId, s.name]));
    return (id: string | null) => (id ? map.get(id) ?? id : "All stores");
  }, [data]);
  const roleName = useMemo(() => {
    const map = new Map((data?.roles ?? []).map((r) => [r.roleId, r.roleName]));
    return (id: string) => map.get(id) ?? id;
  }, [data]);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const refresh = () => {
    void reload();
    refreshOrg();
  };

  async function resendInvite(user: AppUser) {
    setResending(user.appUserId);
    try {
      const invitation = await api.resendInvite(orgId, user.appUserId);
      setAction({ kind: "invite", user, invitation });
      toast(invitation.emailed ? `Invitation re-sent to ${user.email}` : "New invitation code issued", "success");
    } catch (e) {
      toast(errorMessage(e, "Couldn't re-send the invitation."), "error");
    } finally {
      setResending(null);
    }
  }

  async function enable(user: AppUser) {
    try {
      await api.updateUser(orgId, user.appUserId, { status: "active" });
      toast(`${user.name || user.email} enabled`, "success");
      refresh();
    } catch (e) {
      toast(errorMessage(e, "Couldn't enable the user."), "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          People who sign in to the desktop app or the phone at {org.name}&apos;s stores. A login can belong to several
          organizations; access here never changes it elsewhere.
        </p>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)} disabled={data.roles.length === 0}>
          Add user
        </Button>
      </div>
      {data.roles.length === 0 ? <Notice tone="amber">Create a role on the Roles tab before adding users.</Notice> : null}

      {data.users.length === 0 ? (
        <EmptyState title="No users yet">Add the store owner or manager first, with a login and password or an invitation.</EmptyState>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <caption className="sr-only">Users</caption>
            <thead className={table.thead}>
              <tr>
                <th scope="col" className={table.th}>Login</th>
                <th scope="col" className={table.th}>Name</th>
                <th scope="col" className={table.th}>How they sign in</th>
                <th scope="col" className={table.th}>Stores and roles</th>
                <th scope="col" className={table.th}>Status</th>
                <th scope="col" className={table.th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const how = signInLabel(u);
                const active = u.assignments.filter((a) => a.status === "active");
                const managed = u.loginType === "managed";
                return (
                  <tr key={u.appUserId} className={table.tr}>
                    <td className={`${table.td} font-medium`}>{u.email}</td>
                    <td className={table.td}>{u.name || <span className="text-slate-400">—</span>}</td>
                    <td className={table.td}>
                      <Chip tone={how.tone}>{how.label}</Chip>
                      {u.loginChangeBlocked ? (
                        <div className="mt-1 max-w-xs text-[11.5px] text-slate-500">{u.loginChangeBlocked}</div>
                      ) : null}
                    </td>
                    <td className={table.td}>
                      {active.length === 0 ? (
                        <span className="text-slate-400">No access</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {active.map((a) => (
                            <li key={a.assignmentId} className="whitespace-nowrap text-[13px]">
                              <span className="font-medium">{storeName(a.storeId)}</span>
                              <span className="text-slate-500"> · {roleName(a.role)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={`${table.td} whitespace-nowrap`}>
                      {u.status === "disabled" ? (
                        <Chip tone="gray" dot>Disabled</Chip>
                      ) : u.status === "pending_enrollment" ? (
                        <Chip tone="amber" dot>Not enrolled</Chip>
                      ) : (
                        <Chip tone="green" dot>Active</Chip>
                      )}
                      {u.lastLoginAt ? (
                        <div className="mt-0.5 text-[11.5px] text-slate-500" title={formatDateTime(u.lastLoginAt)}>
                          signed in {relativeTime(u.lastLoginAt)}
                        </div>
                      ) : null}
                    </td>
                    <td className={`${table.td} text-right`}>
                      {resending === u.appUserId ? <Spinner label="Sending" /> : null}
                      <RowMenu
                        label={`Actions for ${u.email}`}
                        items={[
                          { label: "Change role or store", onSelect: () => setAction({ kind: "assignments", user: u }), hidden: active.length === 0 },
                          { label: "Add a store", onSelect: () => setAction({ kind: "add-store", user: u }) },
                          // A login another organization shares or created: these change it everywhere, so
                          // the server refuses them (LOGIN_SHARED) and the row says why instead.
                          { label: "Set new password", onSelect: () => setAction({ kind: "password", user: u }), hidden: !managed || Boolean(u.loginChangeBlocked) },
                          { label: "Re-send invite", onSelect: () => void resendInvite(u), hidden: u.status !== "pending_enrollment" || Boolean(u.loginChangeBlocked) },
                          { label: "Enable", onSelect: () => void enable(u), hidden: u.status !== "disabled" || Boolean(u.loginChangeBlocked) },
                          { label: "Disable", onSelect: () => setAction({ kind: "disable", user: u }), hidden: u.status === "disabled" || Boolean(u.loginChangeBlocked), danger: true },
                          { label: "Revoke access to this organization", onSelect: () => setAction({ kind: "revoke", user: u }), hidden: active.length === 0, danger: true }
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddUserDialog
        open={adding}
        orgId={orgId}
        orgName={org.name}
        stores={data.stores}
        roles={data.roles}
        users={data.users}
        onClose={() => setAdding(false)}
        onAdded={refresh}
      />

      {action?.kind === "assignments" ? (
        <AssignmentsDialog
          orgId={orgId}
          user={action.user}
          stores={data.stores}
          roles={data.roles}
          onClose={() => setAction(null)}
          onChanged={refresh}
        />
      ) : null}

      {action?.kind === "add-store" ? (
        <AddAccessDialog
          orgId={orgId}
          user={action.user}
          stores={data.stores}
          roles={data.roles}
          onClose={() => setAction(null)}
          onAdded={refresh}
        />
      ) : null}

      {action?.kind === "password" ? (
        <PasswordDialog orgId={orgId} user={action.user} onClose={() => setAction(null)} />
      ) : null}

      {action?.kind === "invite" ? (
        <Dialog open onClose={() => setAction(null)} title={`Invitation for ${action.user.email}`} footer={<Button variant="primary" onClick={() => setAction(null)}>Done</Button>}>
          <InvitationDetails invitation={action.invitation} email={action.user.email} />
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={action?.kind === "disable"}
        onClose={() => setAction(null)}
        title={`Disable ${action?.user.name || action?.user.email}?`}
        confirmLabel="Disable user"
        destructive
        onConfirm={async () => {
          if (!action) return;
          await api.updateUser(orgId, action.user.appUserId, { status: "disabled" });
          toast(`${action.user.name || action.user.email} disabled`, "success");
          refresh();
        }}
      >
        <p>
          They can&apos;t sign in anywhere with this login — in every organization — until you enable it again. Stores
          sign them out at their next sync.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={action?.kind === "revoke"}
        onClose={() => setAction(null)}
        title={`Revoke ${action?.user.email}'s access to ${org.name}?`}
        confirmLabel="Revoke access"
        destructive
        onConfirm={async () => {
          if (!action) return;
          const active = action.user.assignments.filter((a) => a.status === "active");
          for (const a of active) await api.revokeAssignment(orgId, action.user.appUserId, a.assignmentId);
          toast(`Access revoked for ${action.user.email}`, "success");
          refresh();
        }}
      >
        <p>
          Removes every store and role they have here. Their login and any access in other organizations stay as they
          are. Stores sign them out at their next sync.
        </p>
      </ConfirmDialog>
    </div>
  );
}

// ── Add user ─────────────────────────────────────────────────────────────────

interface AccessRow {
  storeId: string;
  role: string;
}

function defaultRole(roles: Role[]): string {
  return (roles.find((r) => r.roleId !== "org_admin") ?? roles[0])?.roleId ?? "";
}

function AccessRows({
  rows,
  onChange,
  stores,
  roles
}: {
  rows: AccessRow[];
  onChange: (rows: AccessRow[]) => void;
  stores: Store[];
  roles: Role[];
}) {
  const set = (i: number, patch: Partial<AccessRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const dupes = new Set(rows.map((r) => r.storeId)).size !== rows.length;
  return (
    <fieldset>
      <legend className="mb-1 text-[13px] font-semibold text-slate-700">Access</legend>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <label htmlFor={`acc-store-${i}`} className="sr-only">Store {i + 1}</label>
              <Select id={`acc-store-${i}`} value={row.storeId} onChange={(e) => set(i, { storeId: e.target.value })}>
                <option value={WHOLE_ORG}>All stores (whole organization)</option>
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.name}
                    {s.storeNumber ? ` · #${s.storeNumber}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-40 flex-1">
              <label htmlFor={`acc-role-${i}`} className="sr-only">Role {i + 1}</label>
              <Select id={`acc-role-${i}`} value={row.role} onChange={(e) => set(i, { role: e.target.value })}>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.roleName}
                  </option>
                ))}
              </Select>
            </div>
            {rows.length > 1 ? (
              <Button variant="ghost" size="sm" aria-label={`Remove access row ${i + 1}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {dupes ? <p className="mt-1 text-xs font-medium text-red-600">Each store can appear once.</p> : null}
      {stores.length > rows.length ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1.5"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => {
            const used = new Set(rows.map((r) => r.storeId));
            const next = stores.find((s) => !used.has(s.storeId));
            onChange([...rows, { storeId: next?.storeId ?? WHOLE_ORG, role: rows[rows.length - 1]?.role ?? defaultRole(roles) }]);
          }}
        >
          Another store
        </Button>
      ) : null}
    </fieldset>
  );
}

function PasswordInput({
  value,
  onChange,
  field,
  onGenerate
}: {
  value: string;
  onChange: (v: string) => void;
  field: FieldControlProps;
  onGenerate: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          {...field}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          className="pr-9 font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Button
        icon={<Wand2 className="h-3.5 w-3.5" />}
        onClick={() => {
          onGenerate();
          setShow(true);
        }}
      >
        Generate
      </Button>
    </div>
  );
}

function AddUserDialog({
  open,
  orgId,
  orgName,
  stores,
  roles,
  users,
  onClose,
  onAdded
}: {
  open: boolean;
  orgId: string;
  orgName: string;
  stores: Store[];
  roles: Role[];
  users: AppUser[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"managed" | "invite">("managed");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<{ res: AddUserResult; password: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("managed");
    setEmail("");
    setName("");
    setPassword("");
    setRows([{ storeId: stores[0]?.storeId ?? WHOLE_ORG, role: defaultRole(roles) }]);
    setError(null);
    setTouched(false);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const login = email.trim().toLowerCase();
  const alreadyHere = users.find((u) => u.email.toLowerCase() === login);
  const emailError = !login ? "Required." : !EMAIL_LIKE.test(login) ? "Use an e-mail-style name, like rakesh@storedesk.com." : null;
  const passwordError =
    mode === "managed" && !alreadyHere && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters.` : null;
  const rowsOk = rows.length > 0 && rows.every((r) => r.role) && new Set(rows.map((r) => r.storeId)).size === rows.length;
  const canSubmit = !emailError && !passwordError && rowsOk && !busy;

  async function submit() {
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.addUser(orgId, {
        mode,
        email: login,
        name: name.trim() || undefined,
        password: mode === "managed" && !alreadyHere ? password : undefined,
        assignments: rows.map((r) => ({ storeId: r.storeId || null, role: r.role }))
      });
      onAdded();
      toast(res.existing ? `Access added for ${login}` : `${login} added`, "success");
      setResult({ res, password: mode === "managed" && !res.existing ? password : null });
    } catch (e) {
      setError(errorMessage(e, "Couldn't add the user."));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const { res } = result;
    return (
      <Dialog open={open} onClose={onClose} title={res.existing ? "Access added" : "User added"} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="space-y-3 text-sm">
          {res.existing ? (
            <Notice tone="amber">
              This login already exists — only access to this organization was added. Their password wasn&apos;t changed.
            </Notice>
          ) : null}
          {result.password ? (
            <>
              <p>
                Give these to {res.user.name || "them"} directly. Only a StoreDesk admin can change this password.
              </p>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <span>
                  Login <code className="font-mono">{res.user.email}</code>
                </span>
                <CopyButton value={res.user.email} />
              </div>
              <SecretBox label="Password" value={result.password} />
            </>
          ) : null}
          {res.invitationCode ? (
            <InvitationDetails
              invitation={{ invitationCode: res.invitationCode, expiresAt: res.invitationExpiresAt, emailed: res.emailed }}
              email={res.user.email}
            />
          ) : null}
          <p className="text-slate-600">Stores pick up the new access at their next sync, usually within a minute.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissable={!busy}
      size="lg"
      title={`Add a user to ${orgName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-user-form" busy={busy} disabled={touched && !canSubmit}>
            {alreadyHere ? "Add access" : mode === "invite" ? "Add and invite" : "Add user"}
          </Button>
        </>
      }
    >
      <form
        id="add-user-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">How will they sign in?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { key: "managed", title: "Set login and password now", body: "You choose both. Only a StoreDesk admin can change the password." },
                { key: "invite", title: "Invite by e-mail", body: "They get an invitation code and choose their own password at /enroll." }
              ] as const
            ).map((opt) => (
              <label
                key={opt.key}
                className={`flex cursor-pointer gap-2.5 rounded-md border p-3 text-sm ${mode === opt.key ? "border-[#1A63F4] bg-[#1A63F4]/5" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name="signin-mode"
                  value={opt.key}
                  className="mt-0.5 h-4 w-4 accent-[#1A63F4]"
                  checked={mode === opt.key}
                  onChange={() => setMode(opt.key)}
                />
                <span>
                  <span className="block font-semibold">{opt.title}</span>
                  <span className="block text-xs text-slate-500">{opt.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={mode === "invite" ? "E-mail" : "Login"}
            hint={mode === "invite" ? "The invitation goes here." : "Any e-mail-style name; it doesn't have to be a real mailbox."}
            error={touched || email ? (email ? emailError : touched ? emailError : null) : null}
          >
            {(p) => (
              <Input
                {...p}
                autoFocus
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rakesh@storedesk.com"
              />
            )}
          </Field>
          <Field label="Name" optional>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Rakesh" />}
          </Field>
        </div>

        {alreadyHere ? (
          <Notice tone="amber">
            This login already exists — only access to this organization will be added. Their password won&apos;t change.
          </Notice>
        ) : mode === "managed" ? (
          <Field
            label="Password"
            hint="Only an admin can change it. You'll see it once more after adding, to copy."
            error={touched ? passwordError : null}
          >
            {(p) => <PasswordInput field={p} value={password} onChange={setPassword} onGenerate={() => setPassword(generatePassword())} />}
          </Field>
        ) : (
          <p className="text-[13px] text-slate-600">
            If the login already exists elsewhere, no invitation is sent; they keep their password and get access here.
          </p>
        )}

        <AccessRows rows={rows} onChange={setRows} stores={stores} roles={roles} />
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}

function InvitationDetails({ invitation, email }: { invitation: Invitation; email: string }) {
  const link = enrollUrl();
  return (
    <div className="space-y-3 text-sm">
      {invitation.emailed ? (
        <Notice tone="green">We e-mailed the invitation to {email}.</Notice>
      ) : (
        <Notice tone="blue">E-mail isn&apos;t configured here, so send the code to {email} yourself.</Notice>
      )}
      <SecretBox
        label="Invitation code"
        value={invitation.invitationCode}
        note={
          <>
            Shown once{invitation.expiresAt ? `; expires ${formatDateTime(invitation.expiresAt)}` : ""}. Send it to them
            directly — anyone holding it can claim the login.
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
        <span>
          They open <code className="font-mono">{link}</code>, paste the code and choose a password.
        </span>
        <CopyButton value={link} label="Copy link" />
      </div>
    </div>
  );
}

// ── Row actions ──────────────────────────────────────────────────────────────

function AssignmentsDialog({
  orgId,
  user,
  stores,
  roles,
  onClose,
  onChanged
}: {
  orgId: string;
  user: AppUser;
  stores: Store[];
  roles: Role[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Assignment[]>(user.assignments.filter((a) => a.status === "active"));
  const [edits, setEdits] = useState<Record<string, { storeId: string; role: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = (a: Assignment) => edits[a.assignmentId] ?? { storeId: a.storeId ?? WHOLE_ORG, role: a.role };

  async function save(a: Assignment) {
    const next = current(a);
    setBusy(a.assignmentId);
    setError(null);
    try {
      const patch: { storeId?: string | null; role?: string } = {};
      if (next.storeId !== (a.storeId ?? WHOLE_ORG)) patch.storeId = next.storeId || null;
      if (next.role !== a.role) patch.role = next.role;
      const res = await api.updateAssignment(orgId, user.appUserId, a.assignmentId, patch);
      setItems((list) => list.map((x) => (x.assignmentId === a.assignmentId ? res.assignment ?? { ...x, storeId: next.storeId || null, role: next.role } : x)));
      setEdits((e) => {
        const copy = { ...e };
        delete copy[a.assignmentId];
        return copy;
      });
      toast("Access changed", "success");
      onChanged();
    } catch (e) {
      setError(errorMessage(e, "Couldn't change the access."));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(a: Assignment) {
    setBusy(a.assignmentId);
    setError(null);
    try {
      await api.revokeAssignment(orgId, user.appUserId, a.assignmentId);
      setItems((list) => list.filter((x) => x.assignmentId !== a.assignmentId));
      toast("Access removed", "success");
      onChanged();
    } catch (e) {
      setError(errorMessage(e, "Couldn't remove the access."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onClose={onClose} dismissable={!busy} size="lg" title={`Access for ${user.email}`} footer={<Button variant="primary" onClick={onClose} disabled={Boolean(busy)}>Done</Button>}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">No access left in this organization.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const c = current(a);
            const dirty = c.storeId !== (a.storeId ?? WHOLE_ORG) || c.role !== a.role;
            return (
              <li key={a.assignmentId} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-2.5">
                <Field label="Store" className="min-w-40 flex-1">
                  {(p) => (
                    <Select {...p} value={c.storeId} onChange={(e) => setEdits((x) => ({ ...x, [a.assignmentId]: { ...c, storeId: e.target.value } }))}>
                      <option value={WHOLE_ORG}>All stores (whole organization)</option>
                      {stores.map((s) => (
                        <option key={s.storeId} value={s.storeId}>{s.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Role" className="min-w-40 flex-1">
                  {(p) => (
                    <Select {...p} value={c.role} onChange={(e) => setEdits((x) => ({ ...x, [a.assignmentId]: { ...c, role: e.target.value } }))}>
                      {roles.map((r) => (
                        <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Button variant="primary" size="md" disabled={!dirty} busy={busy === a.assignmentId && dirty} onClick={() => save(a)}>
                  Save
                </Button>
                <Button variant="danger-ghost" disabled={Boolean(busy)} onClick={() => revoke(a)}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <div className="mt-3"><Notice tone="red">{error}</Notice></div> : null}
    </Dialog>
  );
}

function AddAccessDialog({
  orgId,
  user,
  stores,
  roles,
  onClose,
  onAdded
}: {
  orgId: string;
  user: AppUser;
  stores: Store[];
  roles: Role[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const used = new Set(user.assignments.filter((a) => a.status === "active").map((a) => a.storeId ?? WHOLE_ORG));
  const firstFree = stores.find((s) => !used.has(s.storeId))?.storeId ?? (used.has(WHOLE_ORG) ? "" : WHOLE_ORG);
  const [storeId, setStoreId] = useState(firstFree);
  const [role, setRole] = useState(defaultRole(roles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = used.has(storeId);

  async function submit() {
    if (taken) return;
    setBusy(true);
    setError(null);
    try {
      await api.addAssignment(orgId, user.appUserId, { storeId: storeId || null, role });
      toast(`Access added for ${user.email}`, "success");
      onAdded();
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't add the access."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      size="sm"
      title={`Add a store for ${user.email}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="add-access-form" busy={busy} disabled={taken}>Add access</Button>
        </>
      }
    >
      <form id="add-access-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Store" error={taken ? "They already have access here — change the role instead." : undefined}>
          {(p) => (
            <Select {...p} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value={WHOLE_ORG}>All stores (whole organization)</option>
              {stores.map((s) => (
                <option key={s.storeId} value={s.storeId}>{s.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Role">
          {(p) => (
            <Select {...p} value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
              ))}
            </Select>
          )}
        </Field>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}

function PasswordDialog({ orgId, user, onClose }: { orgId: string; user: AppUser; onClose: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const valid = password.length >= MIN_PASSWORD;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.setUserPassword(orgId, user.appUserId, password);
      toast(`Password changed for ${user.email}`, "success");
      setDone(password);
    } catch (e) {
      setError(errorMessage(e, "Couldn't change the password."));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Dialog open onClose={onClose} title="Password changed" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="space-y-3 text-sm">
          <p>
            Give the new password to {user.name || user.email}. Stores sign them out everywhere at their next sync.
          </p>
          <SecretBox label="New password" value={done} />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissable={!busy}
      size="sm"
      title={`Set a new password for ${user.email}`}
      description="The old password stops working and their store sessions are signed out."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" type="submit" form="password-form" busy={busy} disabled={!valid}>Set password</Button>
        </>
      }
    >
      <form id="password-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
          {(p) => <PasswordInput field={p} value={password} onChange={setPassword} onGenerate={() => setPassword(generatePassword())} />}
        </Field>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </form>
    </Dialog>
  );
}
