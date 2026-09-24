"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage } from "../../../_lib/api";
import { formatDateTime, relativeTime } from "../../../_lib/format";
import { Button, Card, DefinitionList, ErrorBanner, SecretBox, Spinner, useLoad } from "../../../_components/ui";

/**
 * Store · PC & phones · StoreDesk Lottery: the key that sets up the store's lottery PC.
 *
 * A store that runs StoreDesk never needs it (the desktop app sets the lottery PC up with one
 * click); a store with the lottery app alone does, and until this card there was no way to get
 * one. The server refuses the key where the store does not sell lottery or has no licence in force,
 * and says why.
 */
export function LotteryPcCard({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.getLotteryPc(storeId), [storeId]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  async function issue() {
    setIssuing(true);
    try {
      const res = await api.issueLotterySetupKey(storeId);
      setIssued(res.setupKey);
      toast("Lottery setup key issued", "success");
      void reload();
    } catch (e) {
      toast(errorMessage(e, "Couldn't issue a lottery setup key."), "error");
    } finally {
      setIssuing(false);
    }
  }

  const pc = data?.installation ?? null;

  return (
    <Card
      title="StoreDesk Lottery"
      description="The PC at the lottery counter. A store running StoreDesk sets it up from StoreDesk Desktop instead; this key is for a store without it."
      actions={
        <Button variant="primary" size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} busy={issuing} onClick={issue}>
          {pc ? "Issue a new lottery key" : "Issue lottery setup key"}
        </Button>
      }
    >
      {error && !data ? <ErrorBanner error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <DefinitionList
          rows={[
            {
              label: "Lottery PC",
              value: pc ? (pc.deviceName ?? "Set up") : <span className="text-slate-500">Not set up</span>
            },
            ...(pc?.activatedAt
              ? [{ label: "Set up", value: <span title={formatDateTime(pc.activatedAt)}>{relativeTime(pc.activatedAt)}</span> }]
              : []),
            ...(pc ? [{ label: "Unused key", value: pc.hasOpenKey ? "Waiting to be used" : "None" }] : [])
          ]}
        />
      ) : null}
      {issued ? (
        <div className="mt-3">
          <SecretBox
            label="Lottery setup key"
            value={issued}
            note={<>Shown once. Anyone with it can set up a lottery PC as this store; a new key moves the store to the PC that uses it.</>}
          />
        </div>
      ) : null}
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Install StoreDesk Lottery on the lottery PC.</li>
        <li>
          Type the <b>Organization tag</b> and choose <b>Find my stores</b>.
        </li>
        <li>Pick this store, paste the key, and choose <b>Finish</b>.</li>
      </ol>
    </Card>
  );
}
