import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlarmClock,
  Calendar,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  LoaderPinwheel,
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
import RevenueChart, {
  type RevenueDay,
} from "@/components/admin/dashboard/RevenueChart";
import RevenueRangeSelect from "@/components/admin/dashboard/RevenueRangeSelect";
import {
  buildRevenueBuckets,
  bucketIndexOf,
  isRevenueRange,
  type RevenueRange,
} from "@/lib/revenue-range";

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
  searchParams: Promise<{
    q?: string;
    period?: string;
    page?: string;
    /** Revenue chart-এর নিজস্ব ছাঁকনি — `period` নয়, দেখুন
     *  RevenueRangeSelect-এর মন্তব্য। */
    revenue?: string;
  }>;
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

  // Revenue chart কোন সময়কাল দেখাবে, আর সেই সময়কালটা কোন খোপে ভাগ
  // হবে। খাঁটি হিসাব, কোনো query লাগে না — তাই নিচের Promise.all-এর
  // আগেই তৈরি, আর chart-এর query গুলো এর প্রথম খোপ থেকে শুরু করে।
  const revenueRange: RevenueRange = isRevenueRange(params.revenue) ? params.revenue : "week";
  const revenueBuckets = buildRevenueBuckets(revenueRange, now);
  const chartStart = revenueBuckets[0].start;

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
    chartOrders,
    chartPurchases,
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
      _sum: { grandTotal: true, taxAmount: true, refundedAmount: true },
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
      _sum: { grandTotal: true, taxAmount: true, refundedAmount: true },
      where: { ...notCancelled, createdAt: { gte: weekStart } },
    }),
    prisma.order.aggregate({
      _sum: { grandTotal: true, taxAmount: true, refundedAmount: true },
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
      where: { ...notCancelled, createdAt: { gte: chartStart } },
      select: {
        createdAt: true,
        grandTotal: true,
        taxAmount: true,
        refundedAmount: true,
      },
    }),
    // সপ্তাহের খরচ — যে সরবরাহ-অর্ডারগুলো সত্যিই এসে পৌঁছেছে।
    //
    // status RECEIVED আর receivedAt দেখা হচ্ছে, createdAt নয়: DRAFT
    // মানে এখনো পাঠানোই হয়নি, ORDERED মানে পাঠানো হয়েছে কিন্তু মাল
    // আসেনি। রেস্তোরাঁর হিসাবে খরচ ধরা হয় মাল হাতে আসার দিনে, যেদিন
    // কাগজ কাটা হয়েছিল সেদিন নয়।
    prisma.purchaseOrder.findMany({
      where: { status: "RECEIVED", receivedAt: { gte: chartStart } },
      select: { receivedAt: true, totalCost: true },
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

  /**
   * রেস্তোরাঁর "net revenue" — অর্থাৎ যেটা সত্যিই দোকানের আয়।
   *
   * তিনটে জিনিস বাদ যায়, তিনটেই শিল্পমানের হিসাবে:
   *
   *   • কর — grandTotal-এ থাকে (EXCLUSIVE মোডে যোগ হয়ে, INCLUSIVE মোডে
   *     ভেতরে লুকিয়ে), কিন্তু ওটা সরকারের টাকা, দোকান কেবল আদায় করে।
   *     দুই মোডেই `grandTotal − taxAmount` ঠিক উত্তর দেয় — schema-র
   *     মন্তব্য দ্রষ্টব্য।
   *
   *   • বকশিশ — এমনিতেই grandTotal-এ নেই (checkout-এ ওটা যোগ হয় তার
   *     পরে, totalAmount-এ)। বেশির ভাগ দেশে ওটা আইনত কর্মীর টাকা।
   *
   *   • ফেরত — ⚠️ এটাই আগে বাদ পড়ছিল, আর এটাই সবচেয়ে বড় ভুল ছিল।
   *     পাঁচ হাজার টাকার order পুরো ফেরত দেওয়ার পরেও dashboard সেটা
   *     আয় হিসেবেই গুনত। "Net sales" মানেই ফেরত বাদ দেওয়ার পর।
   *
   * ফেরতটা অনুপাতে ভাগ করা হয়: বিলের যত অংশ আয় ছিল, ফেরতেরও তত
   * অংশ আয় থেকে যায় — বাকিটা করের ফেরত, যেটা এমনিতেই আমাদের ছিল না।
   * বাস্তবে partial refund ঠিক এভাবেই কাজ করে।
   *
   * ⚠️ gift card আর loyalty point ইচ্ছাকৃতভাবে বাদ যায় না। ওগুলো
   * ছাড় নয়, টাকা দেওয়ার মাধ্যম — আয়টা গিফট কার্ড বিক্রির দিনেই
   * ধরা হয়ে গেছে। তাই ওগুলো grandTotal-এর বাইরে (totalAmount-এ), আর
   * এই হিসাবেও ছোঁয়া হয় না।
   */
  const ZERO = new Prisma.Decimal(0);

  const netRevenueOf = (agg: {
    _sum: {
      grandTotal: Prisma.Decimal | null;
      taxAmount: Prisma.Decimal | null;
      refundedAmount: Prisma.Decimal | null;
    };
  }) => {
    const gross = agg._sum.grandTotal ?? ZERO;
    const tax = agg._sum.taxAmount ?? ZERO;
    const refunded = agg._sum.refundedAmount ?? ZERO;

    const net = gross.minus(tax);
    if (gross.lte(0) || refunded.lte(0)) return net;

    // ফেরতের যে অংশটা আয় ছিল। clamp করা, কারণ refundedAmount হিসাব হয়
    // totalAmount-এর বিপরীতে — যাতে বকশিশও থাকে — তাই বড় বকশিশের একটা
    // পূর্ণ ফেরত তাত্ত্বিকভাবে net-কে ছাড়িয়ে যেতে পারত।
    const revenueRefunded = Prisma.Decimal.min(refunded.times(net).dividedBy(gross), net);
    return net.minus(revenueRefunded);
  };

  const totalRevenue = netRevenueOf(revenueResult);

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
      // Figma-র ঘুরন্ত/কেন্দ্রমুখী চিহ্ন। আগে LoaderCircle ছিল, কিন্তু
      // ওটা একটা নিছক ভাঙা বৃত্ত — স্থির অবস্থায় "কিছু একটা চলছে" না
      // বুঝিয়ে বরং অসম্পূর্ণ দেখায়। LoaderPinwheel-এর কেন্দ্রমুখী
      // পাপড়িগুলো মকআপের সমকেন্দ্রিক বলয়ের অনেক কাছাকাছি।
      //
      // ⚠️ LoaderPinwheel lucide-react-এর তুলনামূলক নতুন icon। build-এ
      // "has no exported member" এলে package পুরনো — তখন `Radar`
      // ব্যবহার করো, ওটাও একটা সমকেন্দ্রিক সর্পিল আর অনেক আগের।
      icon: LoaderPinwheel,
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
    netRevenueOf(thisWeekRevenue).toNumber(),
    netRevenueOf(lastWeekRevenue).toNumber()
  );

  // --- Revenue chart: আয় ও খরচ, খোপ ধরে ---
  //
  // খোপ-ভিত্তিক হিসাবটা এখানে হাতে করা হয়, groupBy দিয়ে নয়। কারণ
  // ফেরতের অনুপাত প্রতিটা order-এর নিজের বিলের উপর নির্ভর করে — SQL-এ
  // যোগ করে ফেললে সেই অনুপাতটাই হারিয়ে যায়।
  const bucketTotals = revenueBuckets.map(() => ({ income: 0, expense: 0, orders: 0 }));

  chartOrders.forEach((order) => {
    const index = bucketIndexOf(revenueBuckets, order.createdAt);
    if (index < 0) return;

    // উপরের netRevenueOf-এর মতোই, শুধু একটা order-এর জন্য।
    const gross = order.grandTotal;
    const net = gross.minus(order.taxAmount);
    const refunded = order.refundedAmount;
    const revenue =
      gross.lte(0) || refunded.lte(0)
        ? net
        : net.minus(Prisma.Decimal.min(refunded.times(net).dividedBy(gross), net));

    // Decimal -> number, কারণ এখান থেকে এগুলো কেবল আকার আর প্রদর্শনের
    // কাজে যায়, কোনো চালানে নয়।
    bucketTotals[index].income += revenue.toNumber();
    bucketTotals[index].orders += 1;
  });

  chartPurchases.forEach((po) => {
    if (!po.receivedAt) return;
    const index = bucketIndexOf(revenueBuckets, po.receivedAt);
    if (index < 0) return;
    bucketTotals[index].expense += po.totalCost.toNumber();
  });

  const dayBuckets: RevenueDay[] = revenueBuckets.map((bucket, index) => {
    const totals = bucketTotals[index];
    return {
      label: bucket.label,
      fullDate: bucket.fullLabel,
      income: totals.income,
      expense: totals.expense,
      profit: totals.income - totals.expense,
      incomeLabel: money(totals.income),
      expenseLabel: money(totals.expense),
      profitLabel: money(totals.income - totals.expense),
      orders: totals.orders,
      // শেষ খোপটাই সবসময় চলতি খোপ — buildRevenueBuckets তাই বানায়।
      isToday: index === revenueBuckets.length - 1,
    };
  });

  const rangeIncome = dayBuckets.reduce((sum, d) => sum + d.income, 0);
  const rangeExpense = dayBuckets.reduce((sum, d) => sum + d.expense, 0);

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
        {/* Figma Typography: Sora, 600 SemiBold, 30px, line-height 100%,
            letter-spacing 0%। রঙ Black/70 — #000000 @ 70% opacity, তাই
            `text-black/70`; একটা কঠিন hex দিলে cream background-এ
            (#F9F6F3) অন্যরকম বসত, কারণ opacity নিচের রঙটা মিশতে দেয়। */}
        <h1 className="font-sora text-[26px] font-semibold leading-none tracking-normal text-black/70 md:text-[30px]">
          Welcome Back,{" "}
          {/* গ্রেডিয়েন্ট লেখা: background-টা লেখার আকারে কেটে নেওয়া হয়।
              `text-transparent` না দিলে লেখাটাই gradient-কে ঢেকে দিত।

              ⚠️ এই দুটো hex sidebar/hero card-এর gradient নয়। ওটা
              #FF9540 → #FF70C6 — ইচ্ছাকৃতভাবে হালকা, কারণ তার উপরে
              সাদা লেখা পড়তে হয়। এখানে gradient-টাই লেখা, তাই Figma-তে
              অনেক বেশি saturated: #FF7100 → #FF1CA4। */}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
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
      {/**
       * Figma-র সারি: Flow Horizontal, Fill 1059 × Hug 142, gap 20px।
       * `gap-5` = 1.25rem = 20px; আগে `gap-4` (16px) ছিল।
       */}
      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          /**
           * Figma-র card: Flow Vertical, Fill 339.67 × Hug 142,
           * radius 16px, padding 16px, gap 20px, BG #FFFFFF।
           *
           * আগে `rounded-[20px] ... p-5` ছিল — radius আর padding দুটোই
           * চার পয়েন্ট বেশি, তাই card গুলো মকআপের চেয়ে গোল আর ফাঁপা
           * দেখাত।
           *
           * ভেতরের দূরত্বটা flex column + gap দিয়ে, mt-* দিয়ে নয়:
           * আগে ছিল mt-4 (16px) আর mt-2 (8px), অর্থাৎ Figma-র সমান
           * ২০/২০-এর বদলে দুটো আলাদা মান।
           */
          <div key={stat.label} className="flex flex-col gap-5 rounded-[16px] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              {/* Figma Typography: Frank Ruhl Libre, 500 Medium, 20px,
                  line-height 100%, letter-spacing 0%, Black/100 #000000।
                  আগে font-semibold (600) আর text-[#121212] ছিল। */}
              <h2 className="font-frank-ruhl text-[20px] font-medium leading-none tracking-normal text-black">
                {stat.label}
              </h2>

              {/**
               * ⚠️ ৩৪px মাপটা Figma panel থেকে সরাসরি নেওয়া নয়, হিসাব
               * করে বার করা — card-এর Hug height 142 থেকে:
               *
               *   142 − 16 − 16 (padding)      = 110
               *   110 − 20 − 20 (দুটো gap)     = 70   ← তিন সারির মোট
               *   70 − 12 ("VS last Week")     = 58
               *   58 − 24 (সংখ্যা)             = 34   ← প্রথম সারির উচ্চতা
               *
               * প্রথম সারিতে সবচেয়ে লম্বা জিনিসটাই উচ্চতা ঠিক করে, আর
               * শিরোনামটা মাত্র 20px — কাজেই ওই ৩৪ বৃত্তটারই।
               * Figma-তে বৃত্তটা select করে মিলিয়ে নিলে নিশ্চিত হওয়া যাবে।
               */}
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
                <stat.icon
                  className="h-[18px] w-[18px] text-[#121212]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Figma Typography: Frank Ruhl Libre, 600 SemiBold, 24px,
                  line-height 100%, letter-spacing 0%, Black/100 #000000।
                  আগে text-[28px] font-bold (700) ছিল। */}
              <p className="font-frank-ruhl text-[24px] font-semibold leading-none tracking-normal text-black">
                {stat.value}
              </p>

              {stat.delta !== null && (
                <span
                  className={`rounded-full px-2.5 py-1.5 font-sora text-[12px] font-normal leading-none ${
                    stat.delta >= 0 ? "bg-[#E4F7EC] text-[#2F9E63]" : "bg-[#FDE8E8] text-[#D2504F]"
                  }`}
                >
                  {stat.delta >= 0 ? "▲ +" : "▼ "}
                  {stat.delta}% week
                </span>
              )}
            </div>

            {/* Figma Typography: Sora, 400 Regular, 12px, line-height
                100%, letter-spacing 0%, Black/70।
                আগে text-gray-500 ছিল — একটা কঠিন ধূসর, যেটা সাদা ছাড়া
                অন্য background-এ ভিন্ন রকম বসে; Black/70 নিচের রঙটা
                মিশতে দেয়। */}
            <p className="font-sora text-[12px] font-normal leading-none tracking-normal text-black/70">
              VS last Week
            </p>
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
              {/* Figma: Sora 400, 16px, Black/70 → অঙ্ক Frank Ruhl 600,
                  28px, #000000, মাঝে 9.58px ফাঁক। */}
              <p className="font-sora text-[16px] font-normal leading-none tracking-normal text-black/70">
                Total Revenue
              </p>
              <p className="mt-[9.58px] font-frank-ruhl text-[28px] font-semibold leading-none tracking-normal text-black">
                {money(rangeIncome)}
              </p>
            </div>
            <RevenueRangeSelect range={revenueRange} />
          </div>

          {/* Figma-র কার্ডে উপরের সারি আর chart-এর মাঝে 27.93px। */}
          <div className="mt-7">
            <RevenueChart days={dayBuckets} />
          </div>

          {/* সপ্তাহের সারাংশ — মকআপে নেই, কিন্তু chart-এর নিচের কমলা
              সারিটা কীসের সেটা লেখা না থাকলে বোঝার উপায় থাকে না, আর
              food cost % ছাড়া রেস্তোরাঁর কোনো সপ্তাহ পড়া যায় না
              (৩০% ধরে রাখাই সাধারণ লক্ষ্য)। */}
          {rangeExpense > 0 && (
            <p className="mt-4 font-sora text-[12px] leading-none text-black/70">
              {money(rangeExpense)} in stock purchases ·{" "}
              {Math.round((rangeExpense / (rangeIncome || 1)) * 100)}% of revenue
            </p>
          )}
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