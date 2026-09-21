"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { StoreCapability } from "@/config/pages";
import { Button, Card, Chip, ErrorBanner, Notice, Spinner, Switch, cx } from "../../../../../_components/ui";
import { useStoreSettings, type StoreTabProps } from "./shared";

/**
 * Store · Features: what the store has and which integrations it may use, as
 * plain switches with one Save (on top of settingsVersion). Integrations are
 * set up on the store PC, in the StoreDesk desktop app; here they are only
 * allowed or not.
 */

const FEATURES: Array<{ key: StoreCapability; label: string; description: string }> = [
  { key: "fuel", label: "Has fuel", description: "Fuel prices, fuel totals, gas in daily numbers." },
  { key: "lottery", label: "Has lottery", description: "Lottery sales and payouts." },
  { key: "coam", label: "Has COAM", description: "Coin-operated amusement machine revenue." },
  { key: "ebt", label: "Takes EBT", description: "Food-stamp tenders on the register; an EBT line in daily numbers." },
  { key: "moneyOrder", label: "Sells money orders", description: "Money-order sales and fees, entered from the form, the sheet or a report." },
  { key: "prepaidGift", label: "Sells prepaid and gift cards", description: "One bucket for phone cards, prepaid cards and gift cards." }
];

const LOTTERY_MODES = [
  "Daily totals from the Google Sheet",
  "Scratch-off inventory by pack",
  "Online and instant sales from the lottery terminal report"
];

type Answer = boolean | null;
type Draft = { caps: Record<StoreCapability, Answer>; googleSheets: boolean; lotteryApp: boolean };

export function FeaturesTab({ orgId, storeId }: StoreTabProps) {
  const settings = useStoreSettings(orgId, storeId);
  const [draft, setDraft] = useState<Draft>({ caps: { fuel: null, lottery: null, coam: null, ebt: null, moneyOrder: null, prepaidGift: null }, googleSheets: false, lotteryApp: false });
  const lotteryNote = useId();

  const saved: Draft | null = settings.data
    ? {
        caps: settings.data.settings.capabilities,
        googleSheets: settings.data.settings.integrations.googleSheets.enabled,
        lotteryApp: settings.data.settings.lottery.appEnabled
      }
    : null;

  useEffect(() => {
    if (settings.data) {
      setDraft({
        caps: settings.data.settings.capabilities,
        googleSheets: settings.data.settings.integrations.googleSheets.enabled,
        lotteryApp: settings.data.settings.lottery.appEnabled
      });
    }
  }, [settings.data]);

  if (settings.error && !settings.data) return <ErrorBanner error={settings.error} onRetry={settings.reload} />;
  if (!settings.data || !saved) return <Spinner />;

  // Every answer "no" and settings never saved: the old default, not the owner's answer.
  const looksUntouched = settings.data.settingsVersion === 1 && FEATURES.every((f) => saved.caps[f.key] === false);
  const dirty =
    FEATURES.some((f) => draft.caps[f.key] !== saved.caps[f.key]) ||
    draft.googleSheets !== saved.googleSheets ||
    draft.lotteryApp !== saved.lotteryApp;

  function save() {
    void settings.save(
      (s) => ({
        ...s,
        capabilities: draft.caps,
        // Switched off with the capability: a store that does not sell lottery cannot run the app.
        lottery: { ...s.lottery, appEnabled: draft.caps.lottery === true && draft.lotteryApp },
        integrations: { ...s.integrations, googleSheets: { ...s.integrations.googleSheets, enabled: draft.googleSheets } }
      }),
      "Features saved"
    );
  }

  return (
    <Card
      title="Features"
      description="What this store has and which integrations it may use. Pages that need a feature the store doesn't have are hidden from every role here."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {looksUntouched ? (
          <div className="mb-3">
            <Notice tone="amber">All set to No and never saved, so likely old defaults. Check each one and save.</Notice>
          </div>
        ) : null}
        <SwitchGroup title="Store features">
          {FEATURES.map((f) => (
            <li key={f.key} className="py-3">
              <AnswerRow
                id={`feat-${f.key}`}
                label={f.label}
                description={f.description}
                value={draft.caps[f.key]}
                onChange={(v) => setDraft((d) => ({ ...d, caps: { ...d.caps, [f.key]: v } }))}
              />
              {f.key === "lottery" && draft.caps.lottery === true ? (
                <div className="ml-12 mt-3">
                  <SwitchRow
                    id="lottery-app"
                    label="StoreDesk Lottery app"
                    description="Let this store set a PC up for the lottery app: the rack, the shift close and its reports."
                    checked={draft.lotteryApp}
                    onChange={(v) => setDraft((d) => ({ ...d, lotteryApp: v }))}
                  />
                </div>
              ) : null}
              {f.key === "lottery" && draft.caps.lottery === true ? (
                <fieldset disabled aria-describedby={lotteryNote} className="ml-12 mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                  <legend className="flex items-center gap-2 px-1 text-[13px] font-semibold text-slate-700">
                    Lottery setup <Chip tone="blue">Coming soon</Chip>
                  </legend>
                  <p id={lotteryNote} className="mb-2 text-xs text-slate-500">
                    How lottery gets recorded. These choices open in a later release.
                  </p>
                  <div className="space-y-1.5">
                    {LOTTERY_MODES.map((mode, i) => (
                      <label key={mode} className="flex cursor-not-allowed items-center gap-2 text-sm text-slate-500">
                        <input type="radio" name="lottery-mode" value={i} className="h-4 w-4" disabled />
                        {mode}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </li>
          ))}
        </SwitchGroup>

        <SwitchGroup title="Integrations">
          <li className="py-3">
            <SwitchRow
              id="int-google-sheets"
              label="Google Sheets"
              description="Connect the store's Google Sheet in the StoreDesk desktop app (Settings). This switch allows it."
              checked={draft.googleSheets}
              onChange={(v) => setDraft((d) => ({ ...d, googleSheets: v }))}
            />
          </li>
          <li className="py-3">
            <SwitchRow
              id="int-gtc"
              label="Georgia Tax Center"
              badge={<Chip tone="blue">Coming soon</Chip>}
              description="Sales tax filing with bank / ACH."
              checked={false}
              disabled
              onChange={() => undefined}
            />
          </li>
        </SwitchGroup>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {dirty ? <span className="mr-auto text-[13px] font-semibold text-amber-700">Unsaved changes</span> : null}
          <Button variant="ghost" disabled={!dirty || settings.saving} onClick={() => setDraft(saved)}>
            Discard
          </Button>
          <Button type="submit" variant="primary" busy={settings.saving} disabled={!dirty}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SwitchGroup({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mb-4">
      <h3 id={headingId} className="text-[12.5px] font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

/** Yes / No, or not answered yet (null). The apps show a capability's pages (fuel) only on Yes. */
function AnswerRow({
  id,
  label,
  description,
  value,
  onChange
}: {
  id: string;
  label: string;
  description: string;
  value: Answer;
  onChange: (value: boolean) => void;
}) {
  const descId = `${id}-desc`;
  const option = (answer: boolean, text: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === answer}
      onClick={() => onChange(answer)}
      className={cx(
        "px-3 py-1 text-[13px] font-semibold first:rounded-l-md last:rounded-r-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A63F4]",
        value === answer ? "bg-[#1A63F4] text-white" : "bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {text}
    </button>
  );
  return (
    <div className="flex items-start gap-3">
      <div role="radiogroup" id={id} aria-label={label} aria-describedby={descId} className="flex shrink-0 divide-x divide-slate-200 rounded-md border border-slate-200">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          {label}
          {value === null ? <Chip tone="amber">Not answered</Chip> : null}
        </p>
        <p id={descId} className="text-[13px] text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  description,
  badge,
  checked,
  disabled,
  onChange
}: {
  id: string;
  label: string;
  description: string;
  badge?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const descId = `${id}-desc`;
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} label={label} describedBy={descId} checked={checked} disabled={disabled} onChange={onChange} />
      <div>
        <label htmlFor={id} className={`flex items-center gap-2 text-sm font-semibold ${disabled ? "text-slate-500" : ""}`}>
          {label}
          {badge}
        </label>
        <p id={descId} className="text-[13px] text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
