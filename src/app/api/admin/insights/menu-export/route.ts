import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { isDashboardPeriod, PERIOD_LABELS, type DashboardPeriod } from "@/lib/dashboard-period";
import {
  DEFAULT_MENU_STATUS,
  isMenuStatus,
  type MenuStatusFilter,
} from "@/lib/menu-status-filter";
import { filterMenuItems, loadMenuInsightSource, withSales } from "@/lib/menu-insights";

/**
 * GET /api/admin/insights/menu-export
 *
 * The "Export Report" button on /admin/insights. One row per menu item,
 * with the same search (?q=), status (?status=) and Top Selling period
 * (?top=, default Today) that are on screen — built from lib/menu-insights,
 * the same code the page uses, so the file always matches what you saw.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("insights");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "insights-menu-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const rawStatus = searchParams.get("status");
  const status: MenuStatusFilter = isMenuStatus(rawStatus) ? rawStatus : DEFAULT_MENU_STATUS;
  const rawPeriod = searchParams.get("top");
  const period: DashboardPeriod = isDashboardPeriod(rawPeriod) ? rawPeriod : "today";

  const [settings, source] = await Promise.all([getRestaurantSettings(), loadMenuInsightSource()]);
  const units = settings.currencyMinorUnits;
  const fixed = (value: number) => value.toFixed(units);

  const rows = withSales(source, filterMenuItems(source.items, q, status), period).sort(
    (a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.title.localeCompare(b.title)
  );

  const header = [
    "Item",
    "Category",
    "Status",
    `Units Sold (${PERIOD_LABELS[period]})`,
    `Revenue (${PERIOD_LABELS[period]})`,
    "Currency",
    "Avg Rating",
    "Reviews",
    "Price",
    "Food Cost",
    "Food Cost %",
    "Margin / Unit",
  ];

  const body = rows.map((item) => [
    item.title,
    item.categoryName,
    item.isAvailable ? "Available" : "Unavailable",
    item.quantity,
    fixed(item.revenue),
    settings.currency,
    item.avgRating === null ? "" : item.avgRating.toFixed(1),
    item.reviewCount,
    fixed(item.price),
    item.hasRecipe ? fixed(item.foodCost) : "",
    item.hasRecipe && item.foodCostPercent !== null ? item.foodCostPercent.toFixed(1) : "",
    item.hasRecipe ? fixed(item.grossMargin) : "",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, body), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-menu-insights-${period}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
