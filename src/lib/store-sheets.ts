import { z } from "zod";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { writeAudit } from "@/lib/audit";
import { connectDb } from "@/lib/db";
import { parseSheetRange, requireServiceAccount, type SheetRange } from "@/lib/google";
import { normalizeStoreSettings } from "@/lib/store-settings";
import { requireStore } from "@/lib/tenant-stores";
import { TenantStoreModel } from "@/models/ControlPlane";

/**
 * The store server's Google Sheets proxy (`/api/v1/edge/google/sheets/*`).
 *
 * The spreadsheet is always the one stored for the calling store
 * (`settings.integrations.googleSheets.spreadsheetId`) — never an id from the
 * request — and only while the admin's switch (`enabled`) is on, so a store PC
 * can reach its own sheet and nothing else StoreDesk's Google account can see.
 * Rate-limited per installation; audited with counts only, never cell values.
 */

// next phase: the store PC reports the sheet connected in the desktop app
// (Settings) through an edge route under the worker credential, e.g.
// `PUT /api/v1/edge/settings/google-sheets {spreadsheetUrl, sheetName,
// headerRow}` → `settings.integrations.googleSheets.{spreadsheetId,
// spreadsheetUrl, sheetName, headerRow}`. It must call
// assertSheetNotInOtherOrganization before saving, must leave `enabled` (the
// admin's switch) alone, and should bump settingsVersion and audit
// `store.settings.report`.

/**
 * One Google Sheet belongs to one organization: StoreDesk's account can open
 * every sheet shared with it, so letting a second organization attach the
 * same sheet would hand it the first one's data. 409 SHEET_IN_USE. Applies
 * when the store PC reports its sheet (next phase).
 */
export async function assertSheetNotInOtherOrganization(organizationId: string, spreadsheetId: string): Promise<void> {
  await connectDb();
  const used = await TenantStoreModel.exists({
    "settings.integrations.googleSheets.spreadsheetId": spreadsheetId,
    organizationId: { $ne: organizationId }
  });
  if (used) {
    throw new ControlPlaneError(
      409,
      "SHEET_IN_USE",
      "This sheet is already connected to another organization's store. Each organization needs its own sheet."
    );
  }
}

export const MAX_READ_ROWS = 5_000;
export const MAX_APPEND_ROWS = 1_000;
export const MAX_APPEND_COLUMNS = 50;
const PER_MINUTE = 60;

export type Worker = { organizationId: string; storeId: string; workerInstallationId: string };

/**
 * The calling store's spreadsheet id: 503 without a service account; 409
 * GOOGLE_SHEETS_NOT_ENABLED when the admin's switch is off or the store has
 * not connected a sheet yet.
 */
export async function storeSpreadsheetId(worker: Worker): Promise<string> {
  enforceRateLimit(`edge-sheets:${worker.workerInstallationId}`, {
    limit: PER_MINUTE,
    windowMs: 60_000,
    code: "GOOGLE_SHEETS_RATE_LIMITED"
  });
  requireServiceAccount();
  const store = await requireStore(worker.organizationId, worker.storeId);
  const sheets = normalizeStoreSettings(store.settings).integrations.googleSheets;
  if (sheets.enabled !== true) {
    throw new ControlPlaneError(409, "GOOGLE_SHEETS_NOT_ENABLED", "Google Sheets is not turned on for this store");
  }
  if (!sheets.spreadsheetId) {
    throw new ControlPlaneError(
      409,
      "GOOGLE_SHEETS_NOT_ENABLED",
      "No Google Sheet is connected for this store yet; connect it in the StoreDesk desktop app (Settings)"
    );
  }
  return sheets.spreadsheetId;
}

export function requireRange(raw: string | null | undefined, maxRows: number): SheetRange {
  const range = raw ? parseSheetRange(raw, maxRows) : null;
  if (!range) {
    throw new ControlPlaneError(
      400,
      "RANGE_INVALID",
      "range: an A1 range within one tab, e.g. Daily!A1:D100, 'Daily Sales'!A:D or Daily"
    );
  }
  if (range.rows !== null && range.rows > maxRows) {
    throw new ControlPlaneError(400, "RANGE_TOO_LARGE", `range: at most ${maxRows} rows per call`);
  }
  return range;
}

const Cell = z.union([z.string().max(50_000), z.number().finite(), z.boolean(), z.null()]);

/** `POST …/sheets/append`. Strict: a spreadsheet id in the body is refused, not ignored. */
export const AppendSchema = z
  .object({
    range: z.string().min(1).max(300),
    values: z
      .array(z.array(Cell).max(MAX_APPEND_COLUMNS, `at most ${MAX_APPEND_COLUMNS} columns per row`))
      .min(1)
      .max(MAX_APPEND_ROWS, `at most ${MAX_APPEND_ROWS} rows per call`)
  })
  .strict();

export function auditSheets(worker: Worker, action: string, metadata: Record<string, unknown>) {
  return writeAudit({
    organizationId: worker.organizationId,
    storeId: worker.storeId,
    workerInstallationId: worker.workerInstallationId,
    actorType: "worker",
    actorId: worker.workerInstallationId,
    action,
    targetType: "store",
    targetId: worker.storeId,
    metadata
  });
}
