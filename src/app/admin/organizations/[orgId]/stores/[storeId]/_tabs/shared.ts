"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { api, errorMessage, isConflict, type Organization, type Store, type StoreSettings } from "../../../../../_lib/api";
import { useLoad } from "../../../../../_components/ui";

export interface StoreTabProps {
  orgId: string;
  storeId: string;
  store: Store;
  org: Organization | null;
  refreshStore: () => void;
}

const answer = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

/** Fills anything a partial settings document leaves out, so the forms always have values. */
export function withDefaults(s: Partial<StoreSettings> | null | undefined): StoreSettings {
  const gs = s?.integrations?.googleSheets;
  return {
    // Not answered stays null: it is not a "no".
    capabilities: {
      fuel: answer(s?.capabilities?.fuel),
      lottery: answer(s?.capabilities?.lottery),
      coam: answer(s?.capabilities?.coam),
      ebt: answer(s?.capabilities?.ebt),
      moneyOrder: answer(s?.capabilities?.moneyOrder),
      prepaidGift: answer(s?.capabilities?.prepaidGift)
    },
    lottery: { setupMode: null, appEnabled: Boolean(s?.lottery?.appEnabled) },
    integrations: {
      googleSheets: {
        enabled: Boolean(gs?.enabled),
        spreadsheetUrl: gs?.spreadsheetUrl ?? null,
        spreadsheetId: gs?.spreadsheetId ?? null,
        sheetName: gs?.sheetName ?? null,
        headerRow: typeof gs?.headerRow === "number" && gs.headerRow >= 1 ? gs.headerRow : 1
      },
      gtc: { status: "coming_soon" }
    },
    timeZone: s?.timeZone ?? null
  };
}

/**
 * The store's settings document with a versioned save. A 409 means someone
 * (another operator, or the store) saved first: say so and reload the latest.
 */
export function useStoreSettings(orgId: string, storeId: string) {
  const { toast } = useToast();
  const load = useLoad(async () => {
    const res = await api.getStoreSettings(orgId, storeId);
    return { ...res, settings: withDefaults(res.settings) };
  }, [orgId, storeId]);
  const [saving, setSaving] = useState(false);

  async function save(mutate: (current: StoreSettings) => StoreSettings, success: string): Promise<boolean> {
    if (!load.data) return false;
    setSaving(true);
    try {
      const res = await api.saveStoreSettings(orgId, storeId, load.data.settingsVersion, mutate(load.data.settings));
      load.setData({
        ...load.data,
        ...res,
        settings: withDefaults(res.settings ?? mutate(load.data.settings)),
        settingsVersion: res.settingsVersion ?? load.data.settingsVersion + 1
      });
      toast(success, "success");
      return true;
    } catch (e) {
      if (isConflict(e)) {
        toast("Changed elsewhere — reloaded latest", "info");
        await load.reload();
      } else {
        toast(errorMessage(e, "Couldn't save the store settings."), "error");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { ...load, saving, save };
}
