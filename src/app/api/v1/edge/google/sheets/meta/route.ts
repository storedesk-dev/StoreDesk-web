import { NextResponse } from "next/server";
import { authenticateWorker } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSheetMeta } from "@/lib/google";
import { auditSheets, storeSpreadsheetId } from "@/lib/store-sheets";

/**
 * The store's own Google Sheet: `{spreadsheetId, title, sheets:[{title,
 * rowCount}]}`. Worker credential; the spreadsheet is the one configured for
 * the store, never one named in the request.
 */
export async function GET(req: Request) {
  try {
    const worker = await authenticateWorker(req);
    const spreadsheetId = await storeSpreadsheetId(worker);
    const meta = await getSheetMeta(spreadsheetId);
    await auditSheets(worker, "edge.sheets.meta", { tabs: meta.sheets.length });
    return NextResponse.json(meta, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return jsonError(error);
  }
}
