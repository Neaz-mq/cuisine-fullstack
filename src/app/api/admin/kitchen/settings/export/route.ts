import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { kitchenSettingsRows } from "@/lib/kitchen-settings";

/**
 * GET /api/admin/kitchen/settings/export — "Export Report" on the kitchen
 * Settings page: the five settings as CSV, one line each, worded exactly as
 * on screen (same helper, lib/kitchen-settings.ts, so the file can't differ
 * from the page).
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "kitchen-settings-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const settings = await getRestaurantSettings();
  const csv = toCsv(
    ["Setting", "Value"],
    kitchenSettingsRows({
      timezone: settings.timezone,
      kitchenOpenHour: settings.kitchenOpenHour,
      kitchenCloseHour: settings.kitchenCloseHour,
      lowStockAlerts: settings.lowStockAlerts,
      emergencyStockAlerts: settings.emergencyStockAlerts,
    })
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kitchen-settings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
