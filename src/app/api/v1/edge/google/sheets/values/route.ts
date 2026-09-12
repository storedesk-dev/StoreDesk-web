import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { readSheetValues } from "@/lib/google";
import { MAX_READ_ROWS, auditSheets, requireRange, storeSpreadsheetId } from "@/lib/store-sheets";

/**
 * Read `?range=<A1 range within one tab>` from the store's own sheet:
 * `{range, values, truncated}`. At most 5,000 rows; an open range (`A:D`) is
 * bounded at 5,000 rows and `truncated` says there may be more.
 */
export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const spreadsheetId = await storeSpreadsheetId(worker);
    const range = requireRange(new URL(req.url).searchParams.get("range"), MAX_READ_ROWS);
    const result = await readSheetValues(spreadsheetId, range, MAX_READ_ROWS);
    await auditSheets(worker, "edge.sheets.read", { range: result.range, rows: result.values.length });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
