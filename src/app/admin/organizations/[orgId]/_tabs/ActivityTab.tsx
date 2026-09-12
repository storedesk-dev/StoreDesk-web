"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AuditEvent } from "../../../_lib/api";
import { formatDateTime } from "../../../_lib/format";
import { Button, EmptyState, ErrorBanner, Select, Spinner, table } from "../../../_components/ui";
import { ActivityActor, ActivityTarget, actionLabel } from "../../../_components/activity";
import type { OrgTabProps } from "./types";

export function ActivityTab({ orgId }: OrgTabProps) {
  const [action, setAction] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [knownActions, setKnownActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (from: string | null) => {
      const page = await api.audit(orgId, { cursor: from, action: action || undefined, limit: 50 });
      if (page.actions?.length) setKnownActions(page.actions);
      else setKnownActions((prev) => Array.from(new Set([...prev, ...page.events.map((e) => e.action)])).sort());
      return page;
    },
    // `attempt` re-runs the first page after a failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, action, attempt]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(null)
      .then((page) => {
        if (cancelled) return;
        setEvents(page.events);
        setCursor(page.nextCursor);
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await load(cursor);
      setEvents((prev) => [...prev, ...page.events]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e);
    } finally {
      setLoadingMore(false);
    }
  }

  const actions = useMemo(() => (action && !knownActions.includes(action) ? [action, ...knownActions] : knownActions), [action, knownActions]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="audit-action" className="text-[13px] font-semibold text-slate-700">
          Action
        </label>
        <Select id="audit-action" className="w-64" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <span className="text-[13px] text-slate-500">Every change made here, by stores, and by their users.</span>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState title={action ? `No “${action}” activity` : "No activity yet"} />
      ) : (
        <>
          <div className={table.wrap}>
            <table className={table.table}>
              <caption className="sr-only">Activity</caption>
              <thead className={table.thead}>
                <tr>
                  <th scope="col" className={table.th}>Time</th>
                  <th scope="col" className={table.th}>Actor</th>
                  <th scope="col" className={table.th}>Action</th>
                  <th scope="col" className={table.th}>Target</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.auditEventId} className={table.tr}>
                    <td className={`${table.td} whitespace-nowrap text-slate-600`}>{formatDateTime(ev.occurredAt)}</td>
                    <td className={`${table.td} max-w-[16rem] truncate`}>
                      <ActivityActor event={ev} />
                    </td>
                    <td className={`${table.td} whitespace-nowrap`}>
                      <button type="button" className="hover:opacity-80" onClick={() => setAction(ev.action)} title="Show only this action">
                        {actionLabel(ev.action)}
                      </button>
                    </td>
                    <td className={`${table.td} max-w-[20rem] truncate`}>
                      <ActivityTarget event={ev} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-[13px] text-slate-500">
            <span className="sd-num">{events.length} shown</span>
            {cursor ? (
              <Button busy={loadingMore} onClick={more}>
                Load older
              </Button>
            ) : (
              <span>That&apos;s everything.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
