import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlarmClock,
  Calendar,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  LoaderCircle,
  NotepadText,
  TriangleAlert,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { hasPermission, firstAllowedPath } from "@/lib/permissions";
import BusinessSummaryCard from "@/components/admin/BusinessSummaryCard";
import Pagination from "@/app/admin/orders/Pagination";
import { Prisma } from "@/generated/prisma/client";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import {
  isDashboardPeriod,
  periodStart,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import RevenueHeroCard from "@/components/admin/dashboard/RevenueHeroCard";
import DashboardFilters from "@/components/admin/dashboard/DashboardFilters";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import RevenueBubbleChart, {
  type RevenueDay,
} from "@/components/admin/dashboard/RevenueBubbleChart";

const ORDERS_PER_PAGE = 10;

function formatOrderId(id: string) {
  return `#ORD-${id.slice(-6).toUpperCase()}`;
}

/** "12 Jul, 02:00 am" — Figma-র Date & Time কলামের গড়ন। */
function formatDateTime(date: Date) {
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = date
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${day}, ${time}`;
}

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-[#E8F1FF] text-[#3B82C4]",
  PREPARING: "bg-[#FFF6E0] text-[#C08A2E]",
  OUT_FOR_DELIVERY: "bg-[#FFEDE3] text-[#D9662B]",
  DELIVERED: "bg-[#E4F7EC] text-[#2F9E63]",
  CANCELLED: "bg-[#FDE8E8] text-[#D2504F]",
};

/** Figma-র Order Status কলামে "Order Place" লেখা, enum-এর "PLACED" নয়। */
const STATUS_LABELS: Record<string, string> = {
  PLACED: "Order Place",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Top Selling Items-এর bar রঙ — Figma-র ক্রম অনুযায়ী। */
const BAR_COLORS = ["#F5943F", "#6CC763", "#A87BF5", "#FF6FB5", "#FF8B7A"];

/** শতাংশ পরিবর্তন, নাকি null যদি আগের সময়কালে কিছুই না থাকে —
 *  শূন্য থেকে বাড়াকে "∞% বৃদ্ধি" বলা অর্থহীন, তাই সেই ক্ষেত্রে
 *  তুলনাটাই দেখানো হয় না। */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; page?: string }>;
}) {
  // The dashboard shows revenue and other financial data, which is
  // restricted to the "insights" scope. Roles without it (WAITER,
  // CASHIER, DELIVERY, KITCHEN) get bounced straight to whatever section
  // they DO have — showing them an empty/forbidden dashboard on every
  // login would just be a confusing dead end.
  const session = await requireAdmin();
  const role = (session.user as { role?: string }).role;
  if (!hasPermission(role, "insights")) {
    redirect(firstAllowedPath(role));
  }

  const params = await searchParams;
  const q = params.q?.trim();
  const period: DashboardPeriod = isDashboardPeriod(params.period) ? params.period : "today";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();

  // গত ৭ দিন (আজ সহ), আর তার আগের ৭ দিন — stat card-এর "vs last week"
  // তুলনার দুই প্রান্ত।
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const listSince = periodStart(period, now);

  /** Recent Orders তালিকার শর্ত — এই একই শর্ত export route-ও বানায়। */
  const orderListWhere: Prisma.OrderWhereInput = {
    ...(listSince ? { createdAt: { gte: listSince } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const notCancelled = { status: { not: "CANCELLED" as const } };

  const [
    totalOrders,
    pendingOrders,
    deliveredOrders,
    revenueResult,
    thisWeekStatuses,
    lastWeekStatuses,
    thisWeekRevenue,
    lastWeekRevenue,
    listTotal,
    listOrders,
    weekOrders,
    topItemsRaw,
    inventoryItems,
    todayOrderItems,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: { status: { in: ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"] } },
    }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.aggregate({
      // ⚠️ totalAmount নয় — grandTotal আর taxAmount।
      //
      // totalAmount-এ কর আর বকশিশ দুটোই আছে। করের টাকা সরকারের, বকশিশ
      // কর্মীর — দুটোকেই "আয়" গুনলে মালিকের প্রতিটা সংখ্যা ফুলে যেতো,
      // আর VAT ১৫% এমন দেশে ঠিক ততটাই বেশি।
      _sum: { grandTotal: true, taxAmount: true },
      where: notCancelled,
    }),
    // দুই সপ্তাহের status-ভিত্তিক গণনা এক query-তে — তিনটে card-এর
    // তিনটে আলাদা count নয়।
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: weekStart } },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.order.aggregate({
      _sum: { grandTotal: true, taxAmount: true },
      where: { ...notCancelled, createdAt: { gte: weekStart } },
    }),
    prisma.order.aggregate({
      _sum: { grandTotal: true, taxAmount: true },
      where: { ...notCancelled, createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.order.count({ where: orderListWhere }),
    prisma.order.findMany({
      where: orderListWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      include: { user: { select: { name: true } } },
    }),
    prisma.order.findMany({
      where: { ...notCancelled, createdAt: { gte: weekStart } },
      select: { createdAt: true, grandTotal: true, taxAmount: true },
    }),
    // Top Selling Items — Figma-তে "This Week", তাই সপ্তাহেই সীমাবদ্ধ
    // (আগে সর্বকালের ছিল)।
    prisma.orderItem.findMany({
      where: { order: { ...notCancelled, createdAt: { gte: weekStart } } },
      select: { menuItemId: true, quantity: true, price: true },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: { id: true, currentStock: true, reorderThreshold: true },
    }),
    // "Emergency" গণনার প্রথম ধাপ: আজ যে order গুলো এখনো রান্না/পথে
    // আছে, তাতে কোন কোন menu item আছে।
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: todayStart },
          status: { in: ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"] },
        },
      },
      select: { menuItemId: true },
    }),
  ]);

  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const money = (value: number) => formatAmount(value.toFixed(units), settings.currency);

  const netOf = (agg: { _sum: { grandTotal: Prisma.Decimal | null; taxAmount: Prisma.Decimal | null } }) =>
    (agg._sum.grandTotal ?? new Prisma.Decimal(0)).minus(agg._sum.taxAmount ?? new Prisma.Decimal(0));

  const totalRevenue = netOf(revenueResult);

  const countOf = (
    rows: { status: string; _count: { _all: number } }[],
    statuses: string[]
  ) => rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + r._count._all, 0);

  const IN_PROGRESS = ["PLACED", "PREPARING", "OUT_FOR_DELIVERY"];

  const stats = [
    {
      label: "Total Orders",
      value: totalOrders,
      icon: ClipboardList,
      delta: percentChange(
        thisWeekStatuses.reduce((s, r) => s + r._count._all, 0),
        lastWeekStatuses.reduce((s, r) => s + r._count._all, 0)
      ),
    },
    {
      label: "In Progress",
      value: pendingOrders,
      icon: LoaderCircle,
      delta: percentChange(
        countOf(thisWeekStatuses, IN_PROGRESS),
        countOf(lastWeekStatuses, IN_PROGRESS)
      ),
    },
    {
      label: "Completed Orders",
      value: deliveredOrders,
      icon: ClipboardCheck,
      delta: percentChange(
        countOf(thisWeekStatuses, ["DELIVERED"]),
        countOf(lastWeekStatuses, ["DELIVERED"])
      ),
    },
  ];

  const revenueDelta = percentChange(
    netOf(thisWeekRevenue).toNumber(),
    netOf(lastWeekRevenue).toNumber()
  );

  // --- সাপ্তাহিক আয়ের বৃত্ত-নকশা ---
  // gross আর tax আলাদা করে জমে, কারণ Figma-র tooltip-এ তিনটে সারি —
  // আর তিনটে সংখ্যা একে অপরের সাথে মিলতে হবে (gross − tax = revenue),
  // নাহলে মালিক ঠিক ওখানেই আটকে যাবেন।
  const dayTotals = Array.from({ length: 7 }, () => ({ gross: 0, tax: 0, orders: 0 }));

  const dayBuckets: RevenueDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dayBuckets.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      fullDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      revenue: 0,
      grossLabel: money(0),
      taxLabel: money(0),
      revenueLabel: money(0),
      orders: 0,
      // weekStart থেকে ৭ দিন, আজ সহ — তাই শেষ খোপটাই আজ।
      isToday: i === 6,
    });
  }
  weekOrders.forEach((order) => {
    const dayIndex = Math.floor(
      (new Date(order.createdAt).setHours(0, 0, 0, 0) - weekStart.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      // Decimal -> number, কারণ এগুলো কেবল আকার আর প্রদর্শনের জন্য।
      // কোনো চালানে যায় না, তাই এখানে float সম্পূর্ণ নিরাপদ।
      dayTotals[dayIndex].gross += order.grandTotal.toNumber();
      dayTotals[dayIndex].tax += order.taxAmount.toNumber();
      dayTotals[dayIndex].orders += 1;
    }
  });
  dayBuckets.forEach((day, index) => {
    const totals = dayTotals[index];
    day.revenue = totals.gross - totals.tax;
    day.grossLabel = money(totals.gross);
    day.taxLabel = money(totals.tax);
    day.revenueLabel = money(day.revenue);
    day.orders = totals.orders;
  });
  const weekTotal = dayBuckets.reduce((sum, d) => sum + d.revenue, 0);

  // --- Top-selling items ---
  // OrderItem.price is a UNIT price (confirmed by every other place in the
  // app — admin orders list, order detail, customer order history — which
  // all render `item.price * item.quantity` as the line total). A raw
  // `_sum: { price: true }` groupBy would sum unit prices across lines
  // without multiplying by quantity, undercounting revenue for any item
  // ever ordered with quantity > 1. So we aggregate in JS instead.
  const itemStatsMap = new Map<string, { quantity: number; revenue: number }>();
  topItemsRaw.forEach((line) => {
    const existing = itemStatsMap.get(line.menuItemId) ?? { quantity: 0, revenue: 0 };
    existing.quantity += line.quantity;
    existing.revenue += line.price.toNumber() * line.quantity;
    itemStatsMap.set(line.menuItemId, existing);
  });

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: [...itemStatsMap.keys()] } },
    select: { id: true, title: true },
  });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m.title]));
  const topItems = [...itemStatsMap.entries()]
    .map(([menuItemId, s]) => ({
      title: menuItemMap.get(menuItemId) ?? "Unknown item",
      quantity: s.quantity,
      revenue: s.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxItemRevenue = Math.max(...topItems.map((t) => t.revenue), 1);

  // --- Kitchen Inventory ---
  const outOfStockIds = new Set(
    inventoryItems.filter((item) => item.currentStock <= 0).map((item) => item.id)
  );
  // Low stock: দোরগোড়ায় নেমেছে কিন্তু এখনো শেষ হয়নি। threshold 0 মানে
  // "এখনো কোনো সতর্কতা ঠিক করা হয়নি" (schema-র নিজের ভাষ্য), তাই
  // সেগুলো গোনা হয় না — নাহলে প্রতিটা নতুন উপকরণ দিনের প্রথম দিনেই
  // low stock হয়ে বসে থাকত।
  const lowStockCount = inventoryItems.filter(
    (item) =>
      item.reorderThreshold > 0 &&
      item.currentStock > 0 &&
      item.currentStock <= item.reorderThreshold
  ).length;

  /**
   * Emergency — আজকের যে order গুলো এখনো হাতে আছে, সেগুলো রাঁধতে যে
   * উপকরণ লাগবে অথচ stock শূন্য।
   *
   * "Out of Stock"-এর সাথে পার্থক্যটা জরুরি: গুদামে চিংড়ি শেষ হয়ে
   * থাকা একটা সমস্যা, কিন্তু আজ কেউ চিংড়ি অর্ডার না করলে সেটা আজকের
   * সমস্যা নয়। Emergency শুধু সেগুলোই গোনে যেগুলো *এই মুহূর্তে* একটা
   * order আটকে রেখেছে — অর্থাৎ যে তালিকাটা দেখে রাঁধুনিকে এখনই ফোন
   * করতে হয়।
   */
  const todayMenuItemIds = [...new Set(todayOrderItems.map((line) => line.menuItemId))];
  const todayIngredients = todayMenuItemIds.length
    ? await prisma.menuItemIngredient.findMany({
        where: { menuItemId: { in: todayMenuItemIds } },
        select: { inventoryItemId: true },
      })
    : [];
  const emergencyCount = new Set(
    todayIngredients
      .map((row) => row.inventoryItemId)
      .filter((id) => outOfStockIds.has(id))
  ).size;

  // Figma-তে প্রতিটা কার্ডের ডান কোণে একটা icon — তীব্রতা অনুযায়ী
  // বেছে নেওয়া: নোটবই → সতর্কবার্তা → ত্রিভুজ → ঘড়ি।
  const inventoryStats = [
    {
      label: "Total Items",
      value: inventoryItems.length,
      hint: "Active ingredients tracked",
      icon: NotepadText,
    },
    {
      label: "Low Stock",
      value: lowStockCount,
      hint: "At or below reorder level",
      icon: CircleAlert,
    },
    {
      label: "Out of Stock",
      value: outOfStockIds.size,
      hint: "Blocking menu items",
      icon: TriangleAlert,
    },
    {
      label: "Emergency",
      value: emergencyCount,
      hint: "Needed for today's orders",
      icon: AlarmClock,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(listTotal / ORDERS_PER_PAGE));
  const rangeStart = listTotal === 0 ? 0 : (page - 1) * ORDERS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * ORDERS_PER_PAGE, listTotal);

  return (
    <div className="space-y-4">
      {/* --- Welcome header --- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sora text-[26px] font-bold tracking-[-0.01em] text-[#3A3A3A] md:text-[30px]">
          Welcome Back,{" "}
          {/* গ্রেডিয়েন্ট লেখা: background-টা লেখার আকারে কেটে নেওয়া হয়।
              `text-transparent` না দিলে লেখাটাই gradient-কে ঢেকে দিত। */}
          <span className="bg-gradient-to-r from-[#FF9540] to-[#FF70C6] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-3 font-sora text-[14px] text-[#121212]">
            <Calendar className="h-4 w-4 text-gray-500" strokeWidth={1.8} aria-hidden="true" />
            {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <ExportReportButton />
        </div>
      </div>

      <RevenueHeroCard amount={money(totalRevenue.toNumber())} deltaPercent={revenueDelta} />

      {/* --- তিনটে stat card --- */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[20px] bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-frank-ruhl text-[20px] font-semibold text-[#121212]">
                {stat.label}
              </h2>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
                <stat.icon className="h-4 w-4 text-[#121212]" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <p className="font-frank-ruhl text-[28px] font-bold leading-none text-[#121212]">
                {stat.value}
              </p>
              {stat.delta !== null && (
                <span
                  className={`rounded-full px-2.5 py-1 font-sora text-[12px] font-medium ${
                    stat.delta >= 0 ? "bg-[#E4F7EC] text-[#2F9E63]" : "bg-[#FDE8E8] text-[#D2504F]"
                  }`}
                >
                  {stat.delta >= 0 ? "▲ +" : "▼ "}
                  {stat.delta}% week
                </span>
              )}
            </div>

            <p className="mt-2 font-sora text-[12px] text-gray-500">VS last Week</p>
          </div>
        ))}
      </div>

      <BusinessSummaryCard />

      {/* --- Recent Orders --- */}
      <div className="rounded-[20px] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-bold text-[#121212]">Recent Orders</h2>
          <DashboardFilters period={period} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#F9F6F3]">
                {["No", "Order ID", "Customer Name", "Date & Time", "Order Status", "Amount"].map(
                  (heading, index, all) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`px-4 py-3 text-left font-frank-ruhl text-[16px] font-semibold text-[#121212] ${
                        index === 0 ? "rounded-l-2xl" : ""
                      } ${index === all.length - 1 ? "rounded-r-2xl text-right" : ""}`}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {listOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-sora text-[14px] text-gray-500">
                    {q || period !== "all"
                      ? `No orders match this filter (${PERIOD_LABELS[period]}).`
                      : "No orders yet."}
                  </td>
                </tr>
              ) : (
                listOrders.map((order, index) => (
                  <tr key={order.id}>
                    <td className="px-4 py-4 font-sora text-[14px] text-gray-500">
                      {rangeStart + index}
                    </td>
                    <td className="px-4 py-4 font-sora text-[14px] text-[#121212]">
                      <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                        {formatOrderId(order.id)}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-sora text-[14px] text-gray-600">
                      {order.user?.name ?? `${order.firstName} ${order.lastName}`}
                    </td>
                    <td className="px-4 py-4 font-sora text-[14px] text-gray-600">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block rounded-lg px-3 py-1 font-sora text-[12px] font-medium ${
                          STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-frank-ruhl text-[16px] font-semibold text-[#121212]">
                      {formatAmount(
                        // প্রতিটা order-এর নিজের snapshot — এই তালিকায়
                        // ভিন্ন মুদ্রার order মিশে থাকতে পারে।
                        order.totalAmount.toFixed(order.currencyMinorUnits),
                        order.currency
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-sora text-[13px] text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing <span className="font-semibold text-[#121212]">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-[#121212]">{listTotal}</span> Transactions
          </p>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            searchParams={params}
            basePath="/admin"
          />
        </div>
      </div>

      {/* --- Kitchen Inventory --- */}
      <div className="rounded-[20px] bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-bold text-[#121212]">
            Kitchen Inventory
          </h2>
          <Link
            href="/admin/inventory"
            className="rounded-full bg-[#F9F6F3] px-4 py-2 font-sora text-[13px] text-gray-600 transition-colors hover:bg-gray-100"
          >
            Manage stock →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {inventoryStats.map((item) => (
            <div key={item.label} className="rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-frank-ruhl text-[18px] font-semibold text-[#121212]">
                  {item.label}
                </h3>
                <item.icon
                  className="h-[18px] w-[18px] shrink-0 text-gray-500"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 font-frank-ruhl text-[26px] font-bold leading-none text-[#121212]">
                {item.value}
              </p>
              <p className="mt-2 font-sora text-[12px] text-gray-500">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --- নিচের দুই কার্ড --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[20px] bg-white p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-sora text-[14px] text-gray-500">Total Revenue</p>
              <p className="mt-1 font-frank-ruhl text-[28px] font-bold leading-none text-[#121212]">
                {money(weekTotal)}
              </p>
            </div>
            <span className="rounded-full bg-[#F9F6F3] px-4 py-2 font-sora text-[13px] text-gray-600">
              This Week
            </span>
          </div>

          <div className="mt-6">
            <RevenueBubbleChart days={dayBuckets} />
          </div>
        </div>

        <div className="rounded-[20px] bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-frank-ruhl text-[24px] font-bold text-[#121212]">
              Top Selling Items
            </h2>
            <span className="rounded-full bg-[#F9F6F3] px-4 py-2 font-sora text-[13px] text-gray-600">
              This Week
            </span>
          </div>

          {topItems.length === 0 ? (
            <p className="mt-6 font-sora text-[14px] text-gray-500">No sales this week yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {topItems.map((item, index) => (
                <div key={item.title} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 font-sora text-[13px] text-gray-400">
                    {index + 1}
                  </span>
                  <span className="w-20 shrink-0 font-sora text-[13px] leading-tight text-[#121212] sm:w-28 sm:text-[14px]">
                    {item.title}
                  </span>

                  <div className="h-8 flex-1 rounded-full bg-[#F9F6F3]">
                    <div
                      className="flex h-8 items-center justify-end rounded-full pr-3"
                      style={{
                        // সর্বোচ্চ আয়ের পদটা পুরো চওড়া; বাকিরা তার
                        // অনুপাতে। ন্যূনতম ৪০% — নাহলে ছোট অঙ্কের bar-এর
                        // ভেতরে টাকার লেখাটাই আঁটত না।
                        width: `${Math.max((item.revenue / maxItemRevenue) * 100, 40)}%`,
                        backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                      }}
                    >
                      <span className="font-sora text-[12px] font-semibold text-white">
                        {money(item.revenue)}
                      </span>
                    </div>
                  </div>

                  <span className="w-16 shrink-0 rounded-full bg-[#F9F6F3] px-2 py-1 text-center font-sora text-[12px] text-gray-600">
                    {item.quantity} Sold
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
