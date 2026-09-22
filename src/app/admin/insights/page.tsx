import { Calendar, ChartNoAxesCombined, CircleCheck, CircleDollarSign } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { netRevenueOf } from "@/lib/net-revenue";
import { type FoodCostHealth } from "@/lib/menu-profitability";
import {
  isDashboardPeriod,
  periodStart,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  DEFAULT_MENU_STATUS,
  isMenuStatus,
  type MenuStatusFilter,
} from "@/lib/menu-status-filter";
import {
  filterMenuItems,
  growthWindows,
  loadMenuInsightSource,
  neverSelling,
  profitability,
  revenueByCategory,
  slowestSelling,
  topSelling,
  withSales,
} from "@/lib/menu-insights";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import InsightsToolbar from "./InsightsToolbar";
import InsightsPeriodFilter from "./InsightsPeriodFilter";
import InsightsList, { type InsightRow } from "./InsightsList";

export const metadata = { title: "Insights" };

/**
 * /admin/insights — built to the Figma "Insights" frame (1059px wide,
 * column, gap 24):
 *
 *   Welcome header · date pill · Export Report
 *   Search by Food Name + All Statuses
 *   Overview (3 tiles)
 *   Top Selling Items (bars, 8 per page)
 *   Slowest Selling Items | Never Selling Items
 *   Revenue by Category (bars, 5 per page)
 *
 * Below the Figma frame, in the same card style, Menu Profitability (food
 * cost and margin per item) from the old page.
 *
 * Every card has its own period in the URL (?overview= ?top= ?slow=
 * ?never= ?cat=, default Today), and ?q= / ?status= apply to all the
 * item cards.
 */

// ⚠️ min-w-0: Slowest / Never Selling sit in a CSS grid, and a grid item
// never shrinks below its content by default — at 320px the page-number
// row made both cards wider than the screen and cut them off on the right.
const CARD =
  "flex min-w-0 flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
const CARD_HINT = "font-sora text-[12px] leading-[1.4] text-black/70";

const TOP_PAGE_SIZE = 8;
const SMALL_LIST_PAGE_SIZE = 5;
const CATEGORY_PAGE_SIZE = 5;
const NEVER_SELLING_EMPTY: Record<DashboardPeriod, string> = {
  today: "Every item has sold at least once today.",
  week: "Every item has sold at least once this week.",
  month: "Every item has sold at least once this month.",
  all: "Every menu item has sold at least once. 🎉",
};

const FOOD_COST_STYLES: Record<FoodCostHealth, string> = {
  critical: "bg-[#FFE9EC] text-[#FF3F5C]",
  watch: "bg-[#FFF2DA] text-[#FF9E00]",
  healthy: "bg-[#E8FFEC] text-[#0ECF00]",
  unknown: "bg-[#F9F6F3] text-black/70",
};

function readPeriod(value: string | undefined): DashboardPeriod {
  return isDashboardPeriod(value) ? value : "today";
}

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    overview?: string;
    top?: string;
    slow?: string;
    never?: string;
    cat?: string;
  }>;
}) {
  // The layout already checks the "insights" scope; this call also gives
  // us the session for the welcome name.
  const session = await requireStaff("insights");

  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status: MenuStatusFilter = isMenuStatus(params.status) ? params.status : DEFAULT_MENU_STATUS;
  const periods = {
    overview: readPeriod(params.overview),
    top: readPeriod(params.top),
    slow: readPeriod(params.slow),
    never: readPeriod(params.never),
    cat: readPeriod(params.cat),
  };

  const now = new Date();
  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const money = (value: number) => formatAmount(value.toFixed(units), settings.currency);

  // ── Overview ────────────────────────────────────────────────────────────
  const overviewSince = periodStart(periods.overview, now);
  const createdInOverview = overviewSince ? { createdAt: { gte: overviewSince } } : {};
  const growth = growthWindows(periods.overview, now);

  const [revenueAgg, completedOrders, newCustomers, previousCustomers, source] =
    await Promise.all([
      prisma.order.aggregate({
        _sum: { grandTotal: true, taxAmount: true, refundedAmount: true },
        where: { status: { not: "CANCELLED" }, ...createdInOverview },
      }),
      prisma.order.count({ where: { status: "DELIVERED", ...createdInOverview } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: growth.current } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: growth.previous } }),
      loadMenuInsightSource(),
    ]);

  // New customer sign-ups, this window vs the one before it.
  let growthValue: string;
  if (previousCustomers > 0) {
    const change = ((newCustomers - previousCustomers) / previousCustomers) * 100;
    growthValue = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  } else {
    // Nothing to compare against — a percentage would be infinite.
    growthValue = newCustomers > 0 ? `+${newCustomers} new` : "0%";
  }

  const overviewTiles = [
    {
      label: "Total Revenue",
      value: money(netRevenueOf(revenueAgg).toNumber()),
      hint: periods.overview === "all" ? "All Over" : "Net sales, after tax & refunds",
      icon: CircleDollarSign,
    },
    {
      label: "Total Orders",
      value: completedOrders.toLocaleString("en-US"),
      hint: "Orders Completed",
      icon: CircleCheck,
    },
    {
      label: "Customer Growth",
      value: growthValue,
      hint: growth.label,
      icon: ChartNoAxesCombined,
    },
  ];

  // ── Item cards ──────────────────────────────────────────────────────────
  const items = filterMenuItems(source.items, q, status);

  const top = topSelling(withSales(source, items, periods.top, now));
  const maxTopQuantity = top[0]?.quantity ?? 1;
  const topRows: InsightRow[] = top.map((item) => ({
    key: item.id,
    label: item.title,
    amount: money(item.revenue),
    fraction: item.quantity / maxTopQuantity,
    sold: item.quantity,
  }));

  const slowRows: InsightRow[] = slowestSelling(withSales(source, items, periods.slow, now)).map(
    (item) => ({ key: item.id, label: item.title, sold: item.quantity })
  );

  const neverRows: InsightRow[] = neverSelling(withSales(source, items, periods.never, now)).map(
    (item) => ({
      key: item.id,
      label: item.isAvailable ? item.title : `${item.title} (unavailable)`,
      sold: 0,
    })
  );

  const categories = revenueByCategory(withSales(source, items, periods.cat, now));
  const maxCategoryRevenue = Math.max(...categories.map((c) => c.revenue), 0) || 1;
  const categoryRows: InsightRow[] = categories.map((category) => ({
    key: category.name,
    label: category.name,
    amount: money(category.revenue),
    fraction: category.revenue / maxCategoryRevenue,
  }));

  // Food cost is about the dish, not a period, so this uses all-time sales.
  const { withRecipe, withoutRecipe } = profitability(withSales(source, items, "all", now));

  // Remount each list when its filters change, so it goes back to page 1.
  const filterKey = `${q ?? ""}|${status}`;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Welcome header — same markup as the dashboard ── */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-nowrap items-center gap-2.5 md:w-auto md:justify-start">
          <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black md:h-11 md:flex-none md:justify-start md:px-4 md:text-[14px]">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span>
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </span>
          <ExportReportButton
            endpoint="/api/admin/insights/menu-export"
            forwardParams={["q", "status", "top"]}
            fallbackFilename="cuisine-menu-insights.csv"
          />
        </div>
      </div>

      <InsightsToolbar status={status} />

      {/* ── Overview ── */}
      <section className={`${CARD} gap-6`}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Overview</h2>
          <InsightsPeriodFilter param="overview" value={periods.overview} />
        </div>

        <div className="grid gap-4 min-[640px]:grid-cols-3 md:gap-5">
          {overviewTiles.map((tile) => (
            <div key={tile.label} className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-tight text-black lg:text-[20px] lg:leading-none">
                  {tile.label}
                </h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <tile.icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <p className="break-words font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {tile.value}
                </p>
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">{tile.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Top Selling Items ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Top Selling Items</h2>
          <InsightsPeriodFilter param="top" value={periods.top} />
        </div>
        <InsightsList
          key={`top|${filterKey}|${periods.top}`}
          rows={topRows}
          variant="bar"
          pageSize={TOP_PAGE_SIZE}
          noun="Items"
          emptyText={q ? "No matching item sold in this period." : "No sales in this period yet."}
          alwaysShowFooter
        />
      </section>

      {/* ── Slowest | Never ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <h2 className={CARD_TITLE}>Slowest Selling Items</h2>
            <InsightsPeriodFilter param="slow" value={periods.slow} />
          </div>
          <InsightsList
            key={`slow|${filterKey}|${periods.slow}`}
            rows={slowRows}
            variant="rank"
            pageSize={SMALL_LIST_PAGE_SIZE}
            noun="Items"
            emptyText="Not enough sales in this period yet."
          />
        </section>

        <section className={CARD}>
          <div className="flex items-center justify-between gap-4">
            <h2 className={CARD_TITLE}>Never Selling Items</h2>
            <InsightsPeriodFilter param="never" value={periods.never} />
          </div>
          <InsightsList
            key={`never|${filterKey}|${periods.never}`}
            rows={neverRows}
            variant="rank"
            pageSize={SMALL_LIST_PAGE_SIZE}
            noun="Items"
            emptyText={q ? "No matching item here." : NEVER_SELLING_EMPTY[periods.never]}
          />
        </section>
      </div>

      {/* ── Revenue by Category ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Revenue by Category</h2>
          <InsightsPeriodFilter param="cat" value={periods.cat} />
        </div>
        <InsightsList
          key={`cat|${filterKey}|${periods.cat}`}
          rows={categoryRows}
          variant="bar"
          pageSize={CATEGORY_PAGE_SIZE}
          noun="Categories"
          emptyText="No categories to show."
          alwaysShowFooter
        />
      </section>

      {/* ── Below the Figma frame: food-cost analysis ── */}
      <section className={CARD}>
        <div className="flex flex-col gap-2">
          <h2 className={CARD_TITLE}>Menu Profitability</h2>
          <p className={CARD_HINT}>
            Food cost as a % of price, per item — worst first. Rule of thumb: aim for 28–35%; above
            45% usually means the item loses you money the more it sells.
          </p>
        </div>

        {withRecipe.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.3] text-black/70">
            No menu item has a recipe yet — add ingredients to an item to see its food cost and
            margin here.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 min-[480px]:mx-0 min-[480px]:px-0">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 font-sora text-[14px]">
              <thead>
                <tr className="text-left text-[12px] font-normal text-black/70">
                  {[
                    ["Item", "text-left"],
                    ["Price", "text-right"],
                    ["Food Cost", "text-right"],
                    ["Food Cost %", "text-center"],
                    ["Margin / Unit", "text-right"],
                    ["Units Sold", "text-right"],
                    ["Profit", "text-right"],
                  ].map(([label, align], i, all) => (
                    <th
                      key={label}
                      className={`bg-[#F9F6F3] px-3 py-3 font-normal ${align} ${
                        i === 0 ? "rounded-l-full pl-4" : ""
                      } ${i === all.length - 1 ? "rounded-r-full pr-4" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withRecipe.map((item) => (
                  <tr key={item.id} className="text-black">
                    <td className="max-w-[220px] truncate border-b border-[#F9F6F3] py-3 pl-4 pr-3">
                      {item.title}
                    </td>
                    <td className="border-b border-[#F9F6F3] px-3 py-3 text-right">{money(item.price)}</td>
                    <td className="border-b border-[#F9F6F3] px-3 py-3 text-right">{money(item.foodCost)}</td>
                    <td className="border-b border-[#F9F6F3] px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1.5 text-[12px] font-semibold leading-none ${
                          FOOD_COST_STYLES[item.foodCostHealth]
                        }`}
                      >
                        {item.foodCostPercent?.toFixed(0)}%
                      </span>
                    </td>
                    <td className="border-b border-[#F9F6F3] px-3 py-3 text-right">{money(item.grossMargin)}</td>
                    <td className="border-b border-[#F9F6F3] px-3 py-3 text-right">{item.quantity}</td>
                    <td className="border-b border-[#F9F6F3] py-3 pl-3 pr-4 text-right font-frank-ruhl text-[16px] font-semibold">
                      {money(item.profitContribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {withoutRecipe.length > 0 && (
          <p className={CARD_HINT}>
            {withoutRecipe.length} item{withoutRecipe.length === 1 ? "" : "s"} without a recipe, so
            no food cost can be shown:{" "}
            {withoutRecipe
              .slice(0, 6)
              .map((item) => item.title)
              .join(", ")}
            {withoutRecipe.length > 6 ? `, +${withoutRecipe.length - 6} more` : ""}.
          </p>
        )}
      </section>
    </div>
  );
}
