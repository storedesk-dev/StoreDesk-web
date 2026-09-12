"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage } from "../../../../../_lib/api";
import { Button, Card, Chip, ErrorBanner, Field, Input, Notice, Spinner, useLoad } from "../../../../../_components/ui";
import type { StoreTabProps } from "./shared";

export function RegisterTab({ orgId, storeId }: StoreTabProps) {
  const { toast } = useToast();
  const { data, setData, error, loading, reload } = useLoad(() => api.getPosCredentials(orgId, storeId), [orgId, storeId]);
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHost(data.posIpAddress);
    setUser(data.posUsername);
  }, [data]);

  if (error && !data) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const dirty = host.trim() !== data.posIpAddress || user.trim() !== data.posUsername || password.length > 0;
  const storageOff = data.secretStorageAvailable === false;
  const canSave = dirty && host.trim() && user.trim() && !(password && storageOff) && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await api.savePosCredentials(orgId, storeId, {
        posIpAddress: host.trim(),
        posUsername: user.trim(),
        ...(password ? { posPassword: password } : {})
      });
      setPassword("");
      setData({ ...data!, ...res });
      toast("Register settings saved — the store PC picks them up at its next sync", "success");
    } catch (e) {
      toast(errorMessage(e, "Couldn't save the register settings."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Register (Verifone Commander)"
      description="How the store PC signs in to the register. The password is stored encrypted and only that store's PC ever receives it."
    >
      <form
        className="grid max-w-2xl gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Register address" hint="IP or host name on the store network, e.g. 192.168.31.11" className="sm:col-span-2">
          {(p) => <Input {...p} required spellCheck={false} className="font-mono" value={host} onChange={(e) => setHost(e.target.value)} />}
        </Field>
        <Field label="Register user">
          {(p) => <Input {...p} required spellCheck={false} autoComplete="off" value={user} onChange={(e) => setUser(e.target.value)} />}
        </Field>
        <Field
          label={
            <span className="flex items-center gap-2">
              Register password {data.passwordOnFile ? <Chip tone="green" dot>Saved</Chip> : <Chip tone="gray">Not set</Chip>}
            </span>
          }
          hint={data.passwordOnFile ? "Leave blank to keep the saved password. It is never shown." : "Write-only: it can be set, never read back."}
        >
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="new-password"
              placeholder={data.passwordOnFile ? "••••••••  (saved)" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={storageOff}
            />
          )}
        </Field>
        {storageOff ? (
          <div className="sm:col-span-2">
            <Notice tone="amber">This deployment has no store-secret key, so a register password can&apos;t be stored. Address and user still save.</Notice>
          </div>
        ) : null}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="primary" busy={saving} disabled={!canSave}>
            Save register settings
          </Button>
        </div>
      </form>
    </Card>
  );
}
