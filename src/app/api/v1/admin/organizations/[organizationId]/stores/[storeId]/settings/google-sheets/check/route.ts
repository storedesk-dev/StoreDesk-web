import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { ControlPlaneError, enforceRateLimit } from "@/lib/control-plane-security";
import { jsonError, parseBody } from "@/lib/http";
import { checkSpreadsheet, requireServiceAccount } from "@/lib/google";
import { normalizeStoreSettings, parseSpreadsheetUrl } from "@/lib/store-settings";
import { assertSheetNotInOtherOrganization, requireStore } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

const CheckSchema = z.object({ spreadsheetUrl: z.string().trim().max(500).optional() }).strict();

/**
 * Can StoreDesk's Google account open this sheet? Body `{spreadsheetUrl?}`
 * (defaults to the store's saved link). 200 `{ok, clientEmail, spreadsheetId,
 * title, sheets}`; 422 SHEET_NOT_SHARED / SHEET_NOT_FOUND with `clientEmail`;
 * 503 GOOGLE_NOT_CONFIGURED. Reads only; not audited.
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    enforceRateLimit(`sheet-check:${admin.adminId}`, { limit: 20, windowMs: 60_000 });
    const body = await parseBody(req, CheckSchema);
    const store = await requireStore(organizationId, storeId);
    requireServiceAccount();
    const url = body.spreadsheetUrl || normalizeStoreSettings(store.settings).integrations.googleSheets.spreadsheetUrl;
    const spreadsheetId = parseSpreadsheetUrl(url);
    if (!spreadsheetId) {
      throw new ControlPlaneError(
        400,
        "SPREADSHEET_URL_INVALID",
        "spreadsheetUrl: paste the sheet's link, https://docs.google.com/spreadsheets/d/…"
      );
    }
    // Refused before Google is asked: a sheet another organization attached is theirs.
    await assertSheetNotInOtherOrganization(organizationId, spreadsheetId);
    return NextResponse.json({ ok: true, ...(await checkSpreadsheet(spreadsheetId)) });
  } catch (error) {
    return jsonError(error);
  }
}
