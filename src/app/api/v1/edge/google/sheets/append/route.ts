import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError, parseBody } from "@/lib/http";
import { appendSheetValues } from "@/lib/google";
import { AppendSchema, MAX_APPEND_ROWS, auditSheets, requireRange, storeSpreadsheetId } from "@/lib/store-sheets";

/**
 * Append rows to the store's own sheet: `{range, values}` (at most 1,000 rows
 * of 50 cells) → `{updatedRange, updatedRows}`. Values are written as typed
 * (RAW): a cell starting with "=" stays text, never a formula.
 */
export async function POST(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const spreadsheetId = await storeSpreadsheetId(worker);
    const body = await parseBody(req, AppendSchema);
    const range = requireRange(body.range, MAX_APPEND_ROWS);
    const result = await appendSheetValues(spreadsheetId, range, body.values);
    await auditSheets(worker, "edge.sheets.append", {
      range: result.updatedRange,
      rows: body.values.length,
      columns: Math.max(...body.values.map((row) => row.length)),
      updatedRows: result.updatedRows
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
