"use client";

import type {
  InstallationStatus,
  OrgStatus,
  StoreInstallationSummary,
  StoreStatus,
  StoreTunnel,
  SubscriptionStatus
} from "../_lib/api";
import { relativeTime } from "../_lib/format";
import { Chip, type Tone } from "./ui";

/** A PC counts as online when it checked in within this window. */
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

const SUB: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  trialing: { label: "Trialing", tone: "blue" },
  suspended: { label: "Suspended", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "red" }
};

export function SubscriptionChip({ status }: { status: SubscriptionStatus | null | undefined }) {
  if (!status) return <Chip tone="gray">No subscription</Chip>;
  const s = SUB[status] ?? { label: status, tone: "gray" as Tone };
  return (
    <Chip tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

export function OrgStatusChip({ status }: { status: OrgStatus }) {
  if (status === "suspended") return <Chip tone="amber" dot>Suspended</Chip>;
  if (status === "pending") return <Chip tone="gray" dot>Pending</Chip>;
  return <Chip tone="green" dot>Active</Chip>;
}

export function StoreStatusChip({ status }: { status: StoreStatus }) {
  if (status === "suspended") return <Chip tone="amber" dot>Suspended</Chip>;
  if (status === "closed") return <Chip tone="gray" dot>Closed</Chip>;
  if (status === "pending") return <Chip tone="gray" dot>Pending</Chip>;
  return <Chip tone="green" dot>Active</Chip>;
}

export type PcState = "none" | "awaiting" | "online" | "offline" | "degraded" | "suspended" | "updating";

export function pcState(installation: StoreInstallationSummary | null | undefined): PcState {
  if (!installation) return "none";
  const s: InstallationStatus = installation.status;
  if (s === "awaiting_activation" || s === "not_installed" || s === "installed") return "awaiting";
  if (s === "suspended") return "suspended";
  if (s === "updating" || s === "rollback") return "updating";
  if (s === "degraded") return "degraded";
  const seen = installation.lastSeenAt ? new Date(installation.lastSeenAt).getTime() : 0;
  return Date.now() - seen <= ONLINE_WINDOW_MS ? "online" : "offline";
}

const PC: Record<PcState, { label: string; tone: Tone }> = {
  none: { label: "No PC yet", tone: "gray" },
  awaiting: { label: "Awaiting activation", tone: "amber" },
  online: { label: "Active · online", tone: "green" },
  offline: { label: "Active · offline", tone: "red" },
  degraded: { label: "Degraded", tone: "amber" },
  suspended: { label: "Suspended", tone: "amber" },
  updating: { label: "Updating", tone: "blue" }
};

export function PcChip({ installation }: { installation: StoreInstallationSummary | null | undefined }) {
  const state = pcState(installation);
  const p = PC[state];
  return (
    <Chip tone={p.tone} dot title={installation?.lastSeenAt ? `Last seen ${relativeTime(installation.lastSeenAt)}` : undefined}>
      {p.label}
    </Chip>
  );
}

export const TUNNEL_NOT_CONFIGURED_LABEL = "Remote access isn't set up in this environment";

export function TunnelChip({ tunnel }: { tunnel: StoreTunnel | null | undefined }) {
  if (!tunnel || tunnel.status === "missing") return <Chip tone="gray">No tunnel</Chip>;
  if (tunnel.status === "failed") return <Chip tone="red" dot>Tunnel failed</Chip>;
  if (tunnel.status === "not_configured") {
    return (
      <Chip tone="gray" title={tunnel.message ?? undefined}>
        {TUNNEL_NOT_CONFIGURED_LABEL}
      </Chip>
    );
  }
  return <Chip tone="green" dot>Tunnel ready</Chip>;
}
