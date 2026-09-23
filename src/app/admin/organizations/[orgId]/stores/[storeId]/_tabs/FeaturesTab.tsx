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
  {
    key: "lottery",
    label: "Has lottery",
    description: "Lottery sales and payouts — and this store runs StoreDesk Lottery on its own PC."
  },
  { key: "coam", label: "Has COAM", description: "Coin-operated amusement machine revenue." },
  { key: "ebt", label: "Takes EBT", description: "Food-stamp tenders on the register; an EBT line in daily numbers." },
  { key: "moneyOrder", label: "Sells money orders", description: "Money-order sales and fees, entered from the form, the sheet or a report." },
  { key: "prepaidGift", label: "Sells prepaid and gift cards", description: "One bucket for phone cards, prepaid cards and gift cards." }
];

type Answer = boolean | null;
type Draft = {
  caps: Record<StoreCapability, Answer>;
  googleSheets: boolean;
  storeDeskApp: boolean;
};

export function FeaturesTab({ orgId, storeId }: StoreTabProps) {
  const settings = useStoreSettings(orgId, storeId);
  const [draft, setDraft] = useState<Draft>({
    caps: { fuel: null, lottery: null, coam: null, ebt: null, moneyOrder: null, prepaidGift: null },
    googleSheets: false,
    storeDeskApp: true
  });

  const saved: Draft | null = settings.data
    ? {
        caps: settings.data.settings.capabilities,
        googleSheets: settings.data.settings.integrations.googleSheets.enabled,
        storeDeskApp: settings.data.settings.storedesk.appEnabled
      }
    : null;

  useEffect(() => {
    if (settings.data) {
      setDraft({
        caps: settings.data.settings.capabilities,
        googleSheets: settings.data.settings.integrations.googleSheets.enabled,
        storeDeskApp: settings.data.settings.storedesk.appEnabled
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
    draft.storeDeskApp !== saved.storeDeskApp;

  function save() {
    void settings.save(
      (s) => ({
        ...s,
        capabilities: draft.caps,
        storedesk: { ...s.storedesk, appEnabled: draft.storeDeskApp },
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
        {/*
          Products first, because it is the question that decides the rest: which of the two this
          store runs. They are independent — one, the other, both, or neither — and this is the axis
          a subscription will price, so it reads as a pair rather than as a setting buried under a
          feature.
        */}
        <SwitchGroup title="Products">
          <li className="py-3">
            <SwitchRow
              id="product-storedesk"
              label="StoreDesk"
              description="The register, the daily numbers, the desktop app and the phone. Off: this store cannot set a StoreDesk PC up."
              checked={draft.storeDeskApp}
              onChange={(v) => setDraft((d) => ({ ...d, storeDeskApp: v }))}
            />
          </li>
          <li className="py-3">
            {/*
              Not a switch of its own. A store that sells lottery tickets runs StoreDesk Lottery —
              there is no version of this product where they sell lottery and we point them at
              somebody else's rack. So "Has lottery" below is the whole answer, and this row says
              what that answer currently is rather than asking the question twice.
            */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">StoreDesk Lottery</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {draft.caps.lottery === true
                    ? "On, because this store sells lottery. The rack, the shift close and its reports, on their own PC."
                    : "Switched on by Has lottery below — a store that sells lottery tickets runs our lottery app."}
                </div>
              </div>
              <Chip tone={draft.caps.lottery === true ? "green" : "gray"}>
                {draft.caps.lottery === true ? "On" : "Off"}
              </Chip>
            </div>
          </li>
          {!draft.storeDeskApp && draft.caps.lottery !== true ? (
            <li className="pb-3">
              <Notice tone="amber">
                Neither product is on. Nobody at this store can set a PC up until one of them is.
              </Notice>
            </li>
          ) : null}
        </SwitchGroup>

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
