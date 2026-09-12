import { z } from "zod";
import type { StoreCapability } from "@/config/pages";
import { ControlPlaneError, canonicalJson } from "@/lib/control-plane-security";

/**
 * Store settings (docs/design/control-plane-admin.md, "Data model changes"):
 * three feature switches, the lottery setup (coming soon), integrations, and
 * the store's time zone. Replaces the free-form store config the old admin
 * page edited. Older store records have none of this; every read goes through
 * normalizeStoreSettings, so a missing value is its default.
 */

export type StoreCapabilities = Record<StoreCapability, boolean>;

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
    capabilities: { lottery: false, coam: false, fuel: false },
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
      lottery: capabilities.lottery === true,
      coam: capabilities.coam === true,
      fuel: capabilities.fuel === true
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

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

/**
 * `PUT …/stores/{store}/settings`. Each section given replaces that section;
 * a section left out is kept. Unknown keys are refused. `settingsVersion` is
 * the version the caller read (or send it as `If-Match`). `spreadsheetId` and
 * `gtc` may be echoed back from a GET and are ignored — the id is derived from
 * the link, and GTC is "coming soon".
 */
export const StoreSettingsUpdateSchema = z
  .object({
    settingsVersion: z.number().int().min(1).optional(),
    capabilities: z
      .object({ lottery: z.boolean(), coam: z.boolean(), fuel: z.boolean() })
      .strict()
      .optional(),
    lottery: z.object({ setupMode: z.null() }).strict().optional(),
    integrations: z
      .object({
        googleSheets: z
          .object({
            enabled: z.boolean(),
            spreadsheetUrl: nullableText(500),
            spreadsheetId: z.string().nullable().optional(),
            sheetName: nullableText(100),
            headerRow: z.number().int().min(1).max(1000).default(1)
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
  if (sheets) {
    const spreadsheetId = parseSpreadsheetUrl(sheets.spreadsheetUrl);
    if (sheets.spreadsheetUrl && !spreadsheetId) {
      throw new ControlPlaneError(
        400,
        "SPREADSHEET_URL_INVALID",
        "integrations.googleSheets.spreadsheetUrl: paste the sheet's link, https://docs.google.com/spreadsheets/d/…"
      );
    }
    if (sheets.enabled && !spreadsheetId) {
      throw new ControlPlaneError(
        400,
        "SPREADSHEET_URL_REQUIRED",
        "integrations.googleSheets.spreadsheetUrl: a sheet link is required to turn Google Sheets on"
      );
    }
    next.integrations.googleSheets = {
      enabled: sheets.enabled,
      spreadsheetUrl: sheets.spreadsheetUrl,
      spreadsheetId,
      sheetName: sheets.sheetName,
      headerRow: sheets.headerRow
    };
  }
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
