"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, Mail, RefreshCw, Replace } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type IssuedSetupKey, type SetupKeyStatus } from "../../../../../_lib/api";
import { formatDateTime, relativeTime } from "../../../../../_lib/format";
import {
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  DefinitionList,
  ErrorBanner,
  Notice,
  SecretBox,
  Spinner,
  useLoad
} from "../../../../../_components/ui";
import { PcChip, TunnelChip } from "../../../../../_components/status";
import type { StoreTabProps } from "./shared";

const KEY_STATUS: Record<SetupKeyStatus, string> = {
  queued: "being sent",
  shown: "shown to an admin",
  sent: "e-mailed",
  delivery_failed: "e-mail failed",
  consumed: "used",
  expired: "expired",
  revoked: "cancelled"
};

export function PcPhonesTab({ orgId, storeId, store, refreshStore }: StoreTabProps) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.getStoreSetup(orgId, storeId), [orgId, storeId]);
  const [issuing, setIssuing] = useState<"show" | "email" | null>(null);
  const [issued, setIssued] = useState<IssuedSetupKey | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (error && !data) return <ErrorBanner error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const contact = data.contactEmail ?? store.contactEmail ?? null;
  const blocked = data.keyBlockedReason ?? null;
  const active = data.installation?.status === "active" || data.installation?.status === "degraded";

  async function issue(deliver: "show" | "email") {
    setIssuing(deliver);
    try {
      const res = await api.issueSetupKey(orgId, storeId, deliver);
      if (deliver === "show") {
        setIssued(res);
        toast("Setup key issued", "success");
      } else {
        setIssued(null);
        toast(`Setup key e-mailed to ${res.sentTo ?? contact ?? "the store contact"}`, "success");
      }
      void reload();
    } catch (e) {
      toast(errorMessage(e, "Couldn't issue a setup key."), "error");
    } finally {
      setIssuing(null);
    }
  }

  async function retryTunnel() {
    setRetrying(true);
    try {
      const res = await api.retryTunnel(orgId, storeId);
      toast(
        data?.tunnel.status === "ok" ? "Tunnel rotated; a replaced PC can no longer use it" : res.tunnel?.status === "ok" ? "Tunnel ready" : "Tunnel retry started",
        "success"
      );
      void reload();
      refreshStore();
    } catch (e) {
      toast(errorMessage(e, "Couldn't create the tunnel."), "error");
    } finally {
      setRetrying(false);
    }
  }

  const storeLabel = store.storeNumber ? `Store ${store.storeNumber}` : store.name;

  return (
    <div className="space-y-5">
      <Card
        title="Store PC"
        description="One PC per store runs StoreDesk and talks to the register. It is activated once with a setup key."
      >
        <DefinitionList
          rows={[
            { label: "Status", value: <PcChip installation={data.installation} /> },
            {
              label: "Last seen",
              value: data.installation?.lastSeenAt ? (
                <span className="sd-num" title={formatDateTime(data.installation.lastSeenAt)}>
                  {relativeTime(data.installation.lastSeenAt)}
                </span>
              ) : (
                <span className="text-slate-400">never</span>
              )
            },
            {
              label: "Latest setup key",
              value: data.setupKey ? (
                <span className="sd-num">
                  <span className="font-mono text-[12px]">{data.setupKey.keyId}</span> · {KEY_STATUS[data.setupKey.status] ?? data.setupKey.status}
                  {data.setupKey.status !== "consumed" && data.setupKey.status !== "revoked" ? ` · expires ${formatDateTime(data.setupKey.expiresAt)}` : ""}
                </span>
              ) : (
                <span className="text-slate-400">none issued</span>
              )
            }
          ]}
        />

        {blocked ? (
          <div className="mt-3">
            <Notice tone="amber">
              <span className="font-semibold">A setup key can&apos;t be issued yet:</span> {blocked}
            </Notice>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" icon={<KeyRound className="h-4 w-4" />} busy={issuing === "show"} disabled={Boolean(blocked) || Boolean(issuing) || active} onClick={() => issue("show")}>
            Issue setup key
          </Button>
          <Button
            icon={<Mail className="h-4 w-4" />}
            busy={issuing === "email"}
            disabled={Boolean(blocked) || Boolean(issuing) || !contact || active}
            title={contact ? `Send to ${contact}` : "Add a store contact e-mail on the Overview tab first"}
            onClick={() => issue("email")}
          >
            E-mail key to store contact
          </Button>
          <Button variant="danger-ghost" icon={<Replace className="h-4 w-4" />} disabled={!data.installation} onClick={() => setReplacing(true)}>
            Replace this PC
          </Button>
        </div>
        {active ? (
          <p className="mt-2 text-[13px] text-slate-500">This store&apos;s PC is active. To move StoreDesk to another PC, use Replace this PC first.</p>
        ) : data.setupKey && ["shown", "sent", "queued"].includes(data.setupKey.status) ? (
          <p className="mt-2 text-[13px] text-slate-500">Issuing a new key cancels the earlier unused one.</p>
        ) : null}

        {issued?.setupKey ? (
          <div className="mt-3">
            <SecretBox
              label="Setup key"
              value={issued.setupKey}
              note={<>Shown once; expires {formatDateTime(issued.expiresAt)}. Anyone with it can activate a PC as this store.</>}
            />
          </div>
        ) : null}

        <Steps
          title="On the store PC"
          steps={[
            "Install StoreDesk.",
            <>Open it and choose <b>Set up this PC with a setup key</b>.</>,
            <>Paste the key and the store contact e-mail{contact ? <> (<code className="font-mono text-[12px]">{contact}</code>)</> : null}.</>,
            "Accept and activate.",
            "Sign in with a StoreDesk login assigned to this store."
          ]}
        />
      </Card>

      <Card title="Phones" description="Phones reach the store PC through StoreDesk's secure tunnel.">
        <DefinitionList
          rows={[
            {
              label: "Org tag",
              value: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px]">{data.organizationSlug}</code>,
              action: <CopyButton value={data.organizationSlug} />
            },
            {
              label: "Remote access (tunnel)",
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  <TunnelChip tunnel={data.tunnel} />
                  {data.tunnel.url ? <span className="font-mono text-[12px] text-slate-600">{data.tunnel.url}</span> : null}
                  {data.tunnel.status === "failed" && data.tunnel.message ? (
                    <span className="text-[12.5px] text-red-700">{data.tunnel.message}</span>
                  ) : null}
                  {data.tunnel.rotationRequired && data.tunnel.message ? (
                    <span className="text-[12.5px] text-amber-700">{data.tunnel.message}</span>
                  ) : null}
                  {data.tunnel.status === "not_configured" ? (
                    <span className="text-[12.5px] text-slate-600">
                      Phones can&apos;t reach this store until Cloudflare is configured on this deployment.
                    </span>
                  ) : null}
                </span>
              ),
              action: (
                <Button
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  busy={retrying}
                  onClick={retryTunnel}
                  disabled={data.tunnel.status === "not_configured"}
                  title={data.tunnel.status === "ok" ? "Rotate the tunnel secret; a replaced PC loses access" : undefined}
                >
                  {data.tunnel.status === "ok" ? "Rotate" : "Retry"}
                </Button>
              )
            }
          ]}
        />
        <Steps
          title="On each phone"
          steps={[
            "Install StoreDesk on the phone.",
            <>Enter the org tag <code className="font-mono text-[12px]">{data.organizationSlug}</code>.</>,
            <>Pick <b>{storeLabel}</b>.</>,
            "Sign in with the same StoreDesk login."
          ]}
        />
      </Card>

      <ConfirmDialog
        open={replacing}
        onClose={() => setReplacing(false)}
        title="Replace this PC?"
        confirmLabel="Replace PC"
        destructive
        onConfirm={async () => {
          await api.replacePc(orgId, storeId);
          setIssued(null);
          toast("PC reset — issue a setup key for the new PC", "success");
          void reload();
          refreshStore();
        }}
      >
        <p>
          The current PC stops working until the new one is activated. Its credential is revoked now; the store is then
          waiting for activation and you can issue a setup key for the new PC.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Steps({ title, steps }: { title: string; steps: ReactNode[] }) {
  return (
    <div className="mt-4 rounded-md bg-slate-50 px-3 py-2.5">
      <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      <ol className="space-y-1 text-sm text-slate-700">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="w-4 shrink-0 text-right font-bold text-[#0E43D8] sd-num">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
