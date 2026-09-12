"use client";

import type {
  InstallationStatus,
  LicenseStatus,
  OrgStatus,
  RemoteStatus,
  StoreInstallationSummary,
  StoreLicenseSummary,
  StoreStatus,
  StoreTunnel
} from "../_lib/api";
import { daysUntil, formatDate, relativeTime } from "../_lib/format";
import { Chip, type Tone } from "./ui";

/** A PC counts as online when it checked in within this window. */
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;

const LICENSE_STATUS: Record<LicenseStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  trialing: { label: "Trialing", tone: "blue" },
  suspended: { label: "Suspended", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "red" }
};

export function LicenseStatusChip({ status }: { status: LicenseStatus | null | undefined }) {
  if (!status) return <Chip tone="gray">No license</Chip>;
  const s = LICENSE_STATUS[status] ?? { label: status, tone: "gray" as Tone };
  return (
    <Chip tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

/**
 * How a store is licensed, in one chip: "Master license", "Own license · trial"
 * or "Unlicensed" — plus the status when the license is not in force. The
 * number and end date are in the tooltip.
 */
export function StoreLicenseChip({ license }: { license: StoreLicenseSummary | null | undefined }) {
  if (!license) {
    return (
      <Chip tone="red" dot title="The PC can't activate and sign-in is refused">
        Unlicensed
      </Chip>
    );
  }
  const inForce = license.status === "active" || license.status === "trialing";
  const days = daysUntil(license.entitlementExpiresAt);
  const parts = [license.scope === "organization" ? "Master license" : "Own license"];
  if (license.scope === "store" && license.plan === "trial") parts.push("trial");
  if (!inForce) parts.push((LICENSE_STATUS[license.status]?.label ?? license.status).toLowerCase());
  const tone: Tone = !inForce ? "red" : days !== null && days <= 30 ? "amber" : license.scope === "organization" ? "blue" : "green";
  return (
    <Chip tone={tone} dot title={`${license.licenseNumber} · ends ${formatDate(license.entitlementExpiresAt)}`}>
      {parts.join(" · ")}
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

/** "20:14" today, "Sep 11 20:14" before today. */
export function sinceTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

/** Whether phones can reach the store now: "Tunnel healthy" / "Tunnel down since 20:14"; nothing when unknown. */
export function RemoteChip({ remote }: { remote: RemoteStatus | null | undefined }) {
  if (!remote || remote.status === "unknown") return null;
  if (remote.status === "online") {
    return (
      <Chip tone="green" dot title={remote.since ? `Since ${sinceTime(remote.since)}` : undefined}>
        Tunnel healthy
      </Chip>
    );
  }
  return (
    <Chip tone="red" dot title="Phones can't reach this store">
      {remote.since ? `Tunnel down since ${sinceTime(remote.since)}` : "Tunnel down"}
    </Chip>
  );
}

export const TUNNEL_NOT_CONFIGURED_LABEL = "Remote access isn't set up in this environment";

export function TunnelChip({ tunnel }: { tunnel: StoreTunnel | null | undefined }) {
  if (!tunnel || tunnel.status === "missing") return <Chip tone="gray">No tunnel</Chip>;
  if (tunnel.rotationRequired) {
    return (
      <Chip tone="amber" dot title={tunnel.message ?? undefined}>
        Rotate tunnel
      </Chip>
    );
  }
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
