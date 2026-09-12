"use client";

import type { AuditEvent } from "../_lib/api";

/** The raw action code (`store.settings.update`) — operators filter by it, so it is shown as is. */
export function actionLabel(action: string) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700">{action}</code>;
}

export function ActivityActor({ event }: { event: AuditEvent }) {
  if (event.actorLabel) return <span title={event.actorId}>{event.actorLabel}</span>;
  const kind =
    event.actorType === "internal_admin"
      ? "admin"
      : event.actorType === "app_user"
        ? "user"
        : event.actorType === "worker"
          ? "store PC"
          : event.actorType;
  return (
    <span title={event.actorId}>
      <span className="text-slate-500">{kind}</span> <span className="font-mono text-[12px]">{event.actorId}</span>
    </span>
  );
}

export function ActivityTarget({ event, withOrg = false }: { event: AuditEvent; withOrg?: boolean }) {
  const target = event.targetLabel ?? `${event.targetType.replace(/_/g, " ")} ${event.targetId}`;
  return (
    <span title={`${event.targetType} ${event.targetId}`}>
      {withOrg && event.organizationName ? <span className="text-slate-500">{event.organizationName} · </span> : null}
      {target}
    </span>
  );
}
