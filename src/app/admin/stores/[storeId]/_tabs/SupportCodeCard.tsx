"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, type SupportCodeStatus } from "../../../_lib/api";
import { formatDateTime, relativeTime } from "../../../_lib/format";
import { Button, Card, Chip, ErrorBanner, SecretBox, Spinner, useLoad, type Tone } from "../../../_components/ui";

const STATUS: Record<SupportCodeStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "blue" },
  used: { label: "Used", tone: "green" },
  revoked: { label: "Revoked", tone: "gray" },
  expired: { label: "Expired", tone: "gray" }
};

/**
 * Store · PC & phones · Support code: a one-time code StoreDesk staff read to
 * the store so its PC, stuck at sign-in, unlocks troubleshooting (logs,
 * resetting activation). 30 minutes, once, this store only.
 */
export function SupportCodeCard({ storeId }: { storeId: string }) {
  const { toast } = useToast();
  const { data, error, loading, reload } = useLoad(() => api.listSupportCodes(storeId), [storeId]);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ code: string; expiresAt: string | null } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function issue() {
    setIssuing(true);
    try {
      const res = await api.issueSupportCode(storeId);
      setIssued({ code: res.code, expiresAt: res.supportCode.expiresAt });
      toast("Support code issued", "success");
      void reload();
    } catch (e) {
      toast(errorMessage(e, "Couldn't issue a support code."), "error");
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(supportCodeId: string) {
    setRevoking(supportCodeId);
    try {
      await api.revokeSupportCode(storeId, supportCodeId);
      toast("Support code revoked", "success");
      void reload();
    } catch (e) {
      toast(errorMessage(e, "Couldn't revoke the support code."), "error");
    } finally {
      setRevoking(null);
    }
  }

  const codes = data?.supportCodes ?? [];

  return (
    <Card
      title="Support code"
      description="Unlocks troubleshooting on this store's PC when it is stuck at sign-in (viewing logs, resetting activation). Works once, within 30 minutes, on this store's PC only."
      actions={
        <Button variant="primary" size="sm" icon={<LifeBuoy className="h-3.5 w-3.5" />} busy={issuing} onClick={issue}>
          Issue support code
        </Button>
      }
    >
      {issued ? (
        <div className="mb-3">
          <SecretBox
            label="Support code"
            value={issued.code}
            note={
              <>
                Shown once — read it to the store. Expires {issued.expiresAt ? formatDateTime(issued.expiresAt) : "in 30 minutes"}; works once, on
                this store&apos;s PC only.
              </>
            }
          />
        </div>
      ) : null}

      {error && !data ? (
        <ErrorBanner error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : codes.length === 0 ? (
        <p className="text-sm text-slate-500">No support codes issued for this store.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {codes.map((code) => (
            <li key={code.supportCodeId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Chip tone={STATUS[code.status].tone} dot>
                {STATUS[code.status].label}
              </Chip>
              <span className="text-slate-700">
                by <span className="font-semibold">{code.issuedBy}</span>
                {code.issuedAt ? <span className="text-slate-500"> · issued {relativeTime(code.issuedAt)}</span> : null}
              </span>
              <span className="text-[12.5px] text-slate-500">
                {code.status === "used" && code.usedAt
                  ? `used ${formatDateTime(code.usedAt)}`
                  : code.status === "revoked" && code.revokedAt
                    ? `revoked ${formatDateTime(code.revokedAt)}`
                    : code.expiresAt
                      ? `${code.status === "expired" ? "expired" : "expires"} ${formatDateTime(code.expiresAt)}`
                      : null}
              </span>
              {code.status === "active" ? (
                <Button
                  size="sm"
                  variant="danger-ghost"
                  className="ml-auto"
                  busy={revoking === code.supportCodeId}
                  onClick={() => revoke(code.supportCodeId)}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
