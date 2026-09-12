import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin-auth";
import { ControlPlaneError } from "@/lib/control-plane-security";
import { jsonError, parseValue, readJson } from "@/lib/http";
import { StoreSettingsUpdateSchema } from "@/lib/store-settings";
import { getStoreSettings, updateStoreSettings } from "@/lib/tenant-stores";

type Ctx = { params: Promise<{ organizationId: string; storeId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    return NextResponse.json(await getStoreSettings(organizationId, storeId));
  } catch (error) {
    return jsonError(error);
  }
}

function ifMatchVersion(header: string | null): number | undefined {
  if (!header) return undefined;
  const value = Number(header.replace(/^W\//, "").replace(/"/g, "").trim());
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/**
 * Body `{settingsVersion, settings: {capabilities?, lottery?, integrations?,
 * timeZone?}}` (the sections may also sit at the top level). Each section
 * given replaces that section. 409 SETTINGS_VERSION_CONFLICT with the current
 * settings when the version is stale; the store is notified on a change.
 */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const admin = await requireInternalAdmin(req);
    const { organizationId, storeId } = await ctx.params;
    const raw = await readJson(req);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ControlPlaneError(400, "REQUEST_INVALID", "The body must be an object");
    }
    const body = raw as Record<string, unknown>;
    let sections: unknown = body;
    if ("settings" in body) {
      const extra = Object.keys(body).filter((key) => key !== "settings" && key !== "settingsVersion");
      if (extra.length) throw new ControlPlaneError(400, "REQUEST_INVALID", `${extra[0]}: unknown field`);
      if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
        throw new ControlPlaneError(400, "REQUEST_INVALID", "settings: must be an object");
      }
      sections = {
        ...(body.settings as Record<string, unknown>),
        ...(body.settingsVersion !== undefined ? { settingsVersion: body.settingsVersion } : {})
      };
    }
    const update = parseValue(sections, StoreSettingsUpdateSchema);
    const base = update.settingsVersion ?? ifMatchVersion(req.headers.get("if-match"));
    return NextResponse.json(await updateStoreSettings(admin, organizationId, storeId, update, base));
  } catch (error) {
    return jsonError(error);
  }
}
