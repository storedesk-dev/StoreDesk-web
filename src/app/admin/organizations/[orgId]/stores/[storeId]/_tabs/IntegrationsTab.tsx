"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, errorMessage, type GoogleSheetCheck } from "../../../../../_lib/api";
import { Button, Card, Chip, CopyButton, ErrorBanner, Field, Input, Select, Spinner, Switch } from "../../../../../_components/ui";
import { useStoreSettings, type StoreTabProps } from "./shared";

export function IntegrationsTab({ orgId, storeId }: StoreTabProps) {
  const settings = useStoreSettings(orgId, storeId);
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ url: string; result: GoogleSheetCheck } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    const gs = settings.data.settings.integrations.googleSheets;
    setEnabled(gs.enabled);
    setUrl(gs.spreadsheetUrl ?? "");
    setSheetName(gs.sheetName ?? "");
    setHeaderRow(String(gs.headerRow));
    if (settings.data.googleClientEmail) setClientEmail(settings.data.googleClientEmail);
  }, [settings.data]);

  if (settings.error && !settings.data) return <ErrorBanner error={settings.error} onRetry={settings.reload} />;
  if (!settings.data) return <Spinner />;

  const saved = settings.data.settings.integrations.googleSheets;
  const trimmedUrl = url.trim();
  const checkedThis = check && check.url === trimmedUrl ? check.result : null;
  const urlChanged = trimmedUrl !== (saved.spreadsheetUrl ?? "");
  const tabs = checkedThis?.sheets ?? (sheetName ? [sheetName] : []);
  const headerOk = Number.isInteger(Number(headerRow)) && Number(headerRow) >= 1 && Number(headerRow) <= 100;

  const dirty =
    enabled !== saved.enabled ||
    urlChanged ||
    (sheetName || null) !== saved.sheetName ||
    Number(headerRow) !== saved.headerRow;

  // Turning the integration on with a new link needs a passing Check first.
  const needsCheck = enabled && Boolean(trimmedUrl) && urlChanged && !checkedThis;
  const missing = enabled && (!trimmedUrl || !sheetName);
  const canSave = dirty && headerOk && !needsCheck && !missing && !settings.saving;

  async function runCheck() {
    if (!trimmedUrl) return;
    setChecking(true);
    setCheckError(null);
    try {
      const result = await api.checkGoogleSheet(orgId, storeId, trimmedUrl);
      setCheck({ url: trimmedUrl, result });
      if (result.clientEmail) setClientEmail(result.clientEmail);
      if (!result.sheets.includes(sheetName)) setSheetName(result.sheets[0] ?? "");
    } catch (e) {
      setCheck(null);
      setCheckError(errorMessage(e, "StoreDesk couldn't read that sheet."));
      const body = (e as { body?: { error?: { clientEmail?: string } } }).body;
      if (body?.error?.clientEmail) setClientEmail(body.error.clientEmail);
    } finally {
      setChecking(false);
    }
  }

  function save() {
    if (!canSave) return;
    void settings.save(
      (s) => ({
        ...s,
        integrations: {
          ...s.integrations,
          googleSheets: {
            enabled,
            spreadsheetUrl: trimmedUrl || null,
            spreadsheetId: checkedThis?.spreadsheetId ?? (urlChanged ? null : saved.spreadsheetId),
            sheetName: sheetName || null,
            headerRow: Number(headerRow)
          }
        }
      }),
      enabled ? "Google Sheet saved" : "Google Sheets turned off"
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title="Google Sheets"
        description="The store's daily numbers sheet. StoreDesk reads it with its own Google account; no key goes to the store PC."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-600" id="gs-toggle-label">
              {enabled ? "On" : "Off"}
            </span>
            <Switch label="Google Sheets integration" checked={enabled} onChange={setEnabled} />
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className={enabled ? "" : "opacity-60"}
        >
          <ol className="space-y-4">
            <li className="flex gap-3">
              <StepNumber n={1} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">Share the sheet with StoreDesk</p>
                {clientEmail ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-slate-600">Share it (Viewer is enough) with</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12.5px]">{clientEmail}</code>
                    <CopyButton value={clientEmail} />
                  </div>
                ) : (
                  <p className="mt-1 text-slate-600">StoreDesk&apos;s Google address appears here after the first Check.</p>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <StepNumber n={2} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Sheet link" className="min-w-64 flex-1">
                    {(p) => (
                      <Input
                        {...p}
                        type="url"
                        disabled={!enabled}
                        placeholder="https://docs.google.com/spreadsheets/d/…"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          setCheckError(null);
                        }}
                      />
                    )}
                  </Field>
                  <Button onClick={runCheck} busy={checking} disabled={!enabled || !trimmedUrl}>
                    Check
                  </Button>
                </div>
                {checkedThis ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-emerald-700" role="status">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> StoreDesk can read “{checkedThis.title}” ({checkedThis.sheets.length} tabs)
                  </p>
                ) : checkError ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-red-700" role="alert">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {checkError}
                  </p>
                ) : needsCheck ? (
                  <p className="mt-1.5 text-[13px] text-amber-700">Check the link before saving.</p>
                ) : null}
              </div>
            </li>
            <li className="flex gap-3">
              <StepNumber n={3} />
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                <Field label="Tab" className="min-w-48" hint={!checkedThis && !sheetName ? "Check the link to list its tabs." : undefined}>
                  {(p) => (
                    <Select {...p} disabled={!enabled || tabs.length === 0} value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                      {tabs.length === 0 ? <option value="">—</option> : null}
                      {tabs.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Header row" className="w-28" error={headerOk ? undefined : "1–100"}>
                  {(p) => (
                    <Input {...p} type="number" min={1} max={100} inputMode="numeric" disabled={!enabled} value={headerRow} onChange={(e) => setHeaderRow(e.target.value)} />
                  )}
                </Field>
                <div className="ml-auto">
                  <Button type="submit" variant="primary" busy={settings.saving} disabled={!canSave}>
                    Save
                  </Button>
                </div>
              </div>
            </li>
          </ol>
        </form>
        {!enabled && saved.enabled ? (
          <div className="mt-3 flex justify-end">
            <Button variant="primary" busy={settings.saving} onClick={save} disabled={!canSave}>
              Save — turn off Google Sheets
            </Button>
          </div>
        ) : null}
      </Card>

      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            Georgia Tax Center <Chip tone="blue">Coming soon</Chip>
          </span>
        }
        description="Sales tax filing with bank / ACH."
      >
        <p className="text-sm text-slate-600">
          Filing Georgia sales tax and paying it by bank transfer from StoreDesk. Nothing to set up yet.
        </p>
      </Card>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A63F4]/10 text-xs font-bold text-[#0E43D8]">
      {n}
    </span>
  );
}
