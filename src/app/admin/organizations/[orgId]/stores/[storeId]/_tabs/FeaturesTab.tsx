"use client";

import { useEffect, useId, useState } from "react";
import type { StoreCapability } from "@/config/pages";
import { Button, Card, Chip, ErrorBanner, Spinner, Switch } from "../../../../../_components/ui";
import { useStoreSettings, type StoreTabProps } from "./shared";

const FEATURES: Array<{ key: StoreCapability; label: string; description: string }> = [
  { key: "fuel", label: "Has fuel", description: "Fuel prices, fuel totals, gas in daily numbers." },
  { key: "lottery", label: "Has lottery", description: "Lottery sales and payouts." },
  { key: "coam", label: "Has COAM", description: "Coin-operated amusement machine revenue." }
];

const LOTTERY_MODES = [
  "Daily totals from the Google Sheet",
  "Scratch-off inventory by pack",
  "Online and instant sales from the lottery terminal report"
];

export function FeaturesTab({ orgId, storeId }: StoreTabProps) {
  const settings = useStoreSettings(orgId, storeId);
  const [caps, setCaps] = useState<Record<StoreCapability, boolean>>({ fuel: false, lottery: false, coam: false });
  const lotteryLegend = useId();

  useEffect(() => {
    if (settings.data) setCaps(settings.data.settings.capabilities);
  }, [settings.data]);

  if (settings.error && !settings.data) return <ErrorBanner error={settings.error} onRetry={settings.reload} />;
  if (!settings.data) return <Spinner />;

  const saved = settings.data.settings.capabilities;
  const dirty = FEATURES.some((f) => caps[f.key] !== saved[f.key]);

  return (
    <Card
      title="Features"
      description="What this store sells. Pages that need a feature the store doesn't have are hidden from every role here."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void settings.save((s) => ({ ...s, capabilities: caps }), "Features saved");
        }}
      >
        <ul className="divide-y divide-slate-100">
          {FEATURES.map((f) => {
            const descId = `feat-${f.key}-desc`;
            return (
              <li key={f.key} className="py-3">
                <div className="flex items-start gap-3">
                  <Switch
                    id={`feat-${f.key}`}
                    label={f.label}
                    describedBy={descId}
                    checked={caps[f.key]}
                    onChange={(v) => setCaps((c) => ({ ...c, [f.key]: v }))}
                  />
                  <div>
                    <label htmlFor={`feat-${f.key}`} className="text-sm font-semibold">
                      {f.label}
                    </label>
                    <p id={descId} className="text-[13px] text-slate-500">
                      {f.description}
                    </p>
                  </div>
                </div>

                {f.key === "lottery" && caps.lottery ? (
                  <fieldset disabled aria-describedby={`${lotteryLegend}-note`} className="ml-12 mt-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                    <legend className="flex items-center gap-2 px-1 text-[13px] font-semibold text-slate-700">
                      Lottery setup <Chip tone="blue">Coming soon</Chip>
                    </legend>
                    <p id={`${lotteryLegend}-note`} className="mb-2 text-xs text-slate-500">
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
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {dirty ? <span className="mr-auto text-[13px] font-semibold text-amber-700">Unsaved changes</span> : null}
          <Button variant="ghost" disabled={!dirty || settings.saving} onClick={() => setCaps(saved)}>
            Discard
          </Button>
          <Button type="submit" variant="primary" busy={settings.saving} disabled={!dirty}>
            Save features
          </Button>
        </div>
      </form>
    </Card>
  );
}
