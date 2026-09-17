import { z } from "zod";
import type { StoreCapability } from "@/config/pages";
import { canonicalJson } from "@/lib/control-plane-security";

/**
 * Store settings (docs/design/control-plane-admin.md, "Data model changes"):
 * three feature switches, the lottery setup (coming soon), integrations, and
 * the store's time zone. Replaces the free-form store config the old admin
 * page edited. Older store records have none of this; every read goes through
 * normalizeStoreSettings, so a missing value is its default.
 *
 * Integrations are switches in the admin; they are set up on the store PC.
 * For Google Sheets the admin owns `enabled` only. The sheet itself
 * (`spreadsheetId`, `spreadsheetUrl`, `sheetName`, `headerRow`) is connected
 * in the StoreDesk desktop app and reported by the store PC (next phase: an
 * edge route, see lib/store-sheets.ts).
 */

/**
 * Each capability is true or false once answered, null while not answered
 * (a new store). The store server treats null as present
 * (StoreCapabilitySet.Lacks is an explicit false only); both apps show a
 * capability's pages (fuel) only on a literal true, and so does the admin
 * console's access preview (lib/admin-views.ts).
 */
export type StoreCapabilities = Record<StoreCapability, boolean | null>;

export type GoogleSheetsSettings = {
  enabled: boolean;
  spreadsheetUrl: string | null;
  spreadsheetId: string | null;
  sheetName: string | null;
  headerRow: number;
};

export type StoreSettings = {
  capabilities: StoreCapabilities;
  lottery: { setupMode: null };
  integrations: {
    googleSheets: GoogleSheetsSettings;
    gtc: { status: "coming_soon" };
  };
  timeZone: string | null;
};

export function defaultStoreSettings(): StoreSettings {
  return {
    capabilities: { lottery: null, coam: null, fuel: null, ebt: null, moneyOrder: null, prepaidGift: null },
    lottery: { setupMode: null },
    integrations: {
      googleSheets: { enabled: false, spreadsheetUrl: null, spreadsheetId: null, sheetName: null, headerRow: 1 },
      gtc: { status: "coming_soon" }
    },
    timeZone: null
  };
}

type Loose = Record<string, unknown>;
const record = (value: unknown): Loose =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
/** A capability answer: a stored boolean as it is; anything else (missing, null, odd) is not answered. */
const answer = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const SPREADSHEET_URL = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(?:[/?#].*)?$/;

/** The spreadsheet id from a Google Sheets link, or null when it is not one. */
export function parseSpreadsheetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return SPREADSHEET_URL.exec(url.trim())?.[1] ?? null;
}

export function normalizeStoreSettings(raw: unknown): StoreSettings {
  const source = record(raw);
  const capabilities = record(source.capabilities);
  const sheets = record(record(source.integrations).googleSheets);
  const headerRow = sheets.headerRow;
  const spreadsheetUrl = text(sheets.spreadsheetUrl);
  const timeZone = text(source.timeZone);
  return {
    capabilities: {
      lottery: answer(capabilities.lottery),
      coam: answer(capabilities.coam),
      fuel: answer(capabilities.fuel),
      ebt: answer(capabilities.ebt),
      moneyOrder: answer(capabilities.moneyOrder),
      prepaidGift: answer(capabilities.prepaidGift)
    },
    lottery: { setupMode: null },
    integrations: {
      googleSheets: {
        enabled: sheets.enabled === true,
        spreadsheetUrl,
        spreadsheetId: text(sheets.spreadsheetId) ?? parseSpreadsheetUrl(spreadsheetUrl),
        sheetName: text(sheets.sheetName),
        headerRow:
          typeof headerRow === "number" && Number.isInteger(headerRow) && headerRow >= 1 && headerRow <= 1000
            ? headerRow
            : 1
      },
      gtc: { status: "coming_soon" }
    },
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : null
  };
}

export function readSettingsVersion(store: { settingsVersion?: unknown } | null | undefined): number {
  const version = store?.settingsVersion;
  return typeof version === "number" && Number.isInteger(version) && version >= 1 ? version : 1;
}

export function storeCapabilities(store: { settings?: unknown } | null | undefined): StoreCapabilities {
  return normalizeStoreSettings(store?.settings).capabilities;
}

// ── Update ───────────────────────────────────────────────────────────────────

/**
 * `PUT …/stores/{store}/settings`. Each section given replaces that section;
 * a section left out is kept. Unknown keys are refused. `settingsVersion` is
 * the version the caller read (or send it as `If-Match`).
 *
 * Google Sheets: only `enabled` (the admin's switch) is saved. The sheet
 * fields a GET returns (`spreadsheetId`, `spreadsheetUrl`, `sheetName`,
 * `headerRow`) may be echoed back and are ignored: the store PC reports them.
 * `gtc` may be echoed back too and is ignored ("coming soon").
 */
const Ignored = z.unknown().optional();

export const StoreSettingsUpdateSchema = z
  .object({
    settingsVersion: z.number().int().min(1).optional(),
    capabilities: z
      // null puts a capability back to "not answered".
      .object({
        lottery: z.boolean().nullable(),
        coam: z.boolean().nullable(),
        fuel: z.boolean().nullable(),
        ebt: z.boolean().nullable(),
        moneyOrder: z.boolean().nullable(),
        prepaidGift: z.boolean().nullable()
      })
      .strict()
      .optional(),
    lottery: z.object({ setupMode: z.null() }).strict().optional(),
    integrations: z
      .object({
        googleSheets: z
          .object({
            enabled: z.boolean(),
            spreadsheetUrl: Ignored,
            spreadsheetId: Ignored,
            sheetName: Ignored,
            headerRow: Ignored
          })
          .strict()
          .optional(),
        gtc: z.object({ status: z.literal("coming_soon") }).strict().optional()
      })
      .strict()
      .optional(),
    timeZone: z
      .string()
      .trim()
      .refine(isValidTimeZone, "Unknown time zone; use an IANA name such as America/New_York")
      .nullable()
      .optional()
  })
  .strict();

export type StoreSettingsUpdate = z.output<typeof StoreSettingsUpdateSchema>;

/** Apply an update; `changed` names the sections whose content changed. */
export function applySettingsUpdate(
  current: StoreSettings,
  update: StoreSettingsUpdate
): { settings: StoreSettings; changed: string[] } {
  const next: StoreSettings = normalizeStoreSettings(current);
  if (update.capabilities) next.capabilities = { ...update.capabilities };
  if (update.lottery) next.lottery = { setupMode: null };
  const sheets = update.integrations?.googleSheets;
  // The switch only: the sheet the store PC reported is kept as it is.
  if (sheets) next.integrations.googleSheets = { ...next.integrations.googleSheets, enabled: sheets.enabled };
  if (update.timeZone !== undefined) next.timeZone = update.timeZone;

  const before = normalizeStoreSettings(current);
  const changed: string[] = [];
  if (canonicalJson(before.capabilities) !== canonicalJson(next.capabilities)) changed.push("capabilities");
  if (canonicalJson(before.lottery) !== canonicalJson(next.lottery)) changed.push("lottery");
  if (canonicalJson(before.integrations) !== canonicalJson(next.integrations)) changed.push("integrations");
  if (before.timeZone !== next.timeZone) changed.push("timeZone");
  return { settings: next, changed };
}

/** What the store server receives in the access sync (no secrets exist here). */
export function syncSettingsView(settings: StoreSettings) {
  return {
    lottery: settings.lottery,
    integrations: settings.integrations,
    timeZone: settings.timeZone
  };
}
