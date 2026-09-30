"use client";

import { useState } from "react";
import { Unplug } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api } from "../../../_lib/api";
import { formatDateTime, relativeTime } from "../../../_lib/format";
import { Button, Card, ConfirmDialog, DefinitionList, ErrorBanner, Spinner, useLoad } from "../../../_components/ui";

/**
 * Store · PC & phones · StoreDesk Lottery: which PC runs lottery for the store.
 *
 * There is no key to issue (D-26). A person with lottery pages at the store signs in on the lottery
 * PC with their StoreDesk email and password and picks the store; that binds the PC. This card shows
 * the bound PC and lets an admin release it, which is the same as Switch store on the PC.
 */
export function LotteryPcCard({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.getLotteryPc(storeId), [storeId]);
  const [releasing, setReleasing] = useState(false);

  const pc = data?.pc ?? null;

  return (
    <Card
      title="StoreDesk Lottery"
      description="The PC at the lottery counter. Someone with lottery access signs in on it with their StoreDesk email and password."
      actions={
        pc ? (
          <Button size="sm" icon={<Unplug className="h-3.5 w-3.5" />} onClick={() => setReleasing(true)}>
            Release this PC
          </Button>
        ) : null
      }
    >
      {error && !data ? <ErrorBanner error={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner /> : null}
      {data ? (
        <DefinitionList
          rows={[
            { label: "Lottery PC", value: pc ? pc.pcName : <span className="text-slate-500">None yet</span> },
            ...(pc?.boundAt
              ? [
                  {
                    label: "Since",
                    value: (
                      <span title={formatDateTime(pc.boundAt)}>
                        {relativeTime(pc.boundAt)}, by {pc.boundBy}
                      </span>
                    )
                  }
                ]
              : []),
            ...(pc
              ? [
                  {
                    label: "Last seen",
                    value: pc.lastSeenAt ? <span title={formatDateTime(pc.lastSeenAt)}>{relativeTime(pc.lastSeenAt)}</span> : "Not yet"
                  }
                ]
              : []),
            ...(pc?.appVersion ? [{ label: "Version", value: pc.appVersion }] : [])
          ]}
        />
      ) : null}
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Install StoreDesk Lottery on the lottery PC.</li>
        <li>Sign in with a StoreDesk email and password that has lottery access here.</li>
        <li>Pick this store.</li>
      </ol>

      <ConfirmDialog
        open={releasing}
        onClose={() => setReleasing(false)}
        title="Release the lottery PC?"
        confirmLabel="Release PC"
        destructive
        onConfirm={async () => {
          await api.releaseLotteryPc(storeId);
          toast("Lottery PC released", "success");
          void reload();
        }}
      >
        <p>It stops sending to the cloud at once. Unsent changes stay on it. The next person to sign in on a lottery PC can pick this store.</p>
      </ConfirmDialog>
    </Card>
  );
}
