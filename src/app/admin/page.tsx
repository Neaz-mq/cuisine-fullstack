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
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
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
import RangeSelect from "@/components/admin/dashboard/RangeSelect";
import {
  buildRevenueBuckets,
  bucketIndexOf,
  isRevenueRange,
  type RevenueRange,
} from "@/lib/revenue-range";

const ORDERS_PER_PAGE = 10;

/** "12 Jul, 02:00 am" — Figma-র Date & Time কলামের গড়ন। */
function formatDateTime(date: Date) {
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = date
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${day}, ${time}`;
}

/**
 * Order Status pill-এর রঙ — Figma-র CSS export থেকে।
 *
 * মকআপে তিনটে অবস্থা আঁকা: Delivered, Order Place, Preparing। বাকি
 * দুটো (পথে আছে, বাতিল) নকশায় নেই, তাই একই পরিবারের রঙ বেছে নেওয়া
 * হয়েছে — হালকা পটভূমি + গাঢ় লেখা, আর লালটা design system-এর
 * #FF3F5C, যেটা hero card আর chart tooltip-এও আছে।
 *
 * আগের মানগুলো চোখে মেপে বসানো ছিল আর প্রতিটাই ফিকে — Figma-র
 * সবুজ #0ECF00, আমার ছিল #2F9E63।
 */
const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-[#E5EDFF] text-[#0090FF]",
  PREPARING: "bg-[#FFF2DA] text-[#FF9E00]",
  OUT_FOR_DELIVERY: "bg-[#FFEDE0] text-[#FF7100]",
  DELIVERED: "bg-[#E8FFEC] text-[#0ECF00]",
  CANCELLED: "bg-[#FFE9EC] text-[#FF3F5C]",
};

/** Figma-র Order Status কলামে "Order Place" লেখা, enum-এর "PLACED" নয়। */
const STATUS_LABELS: Record<string, string> = {
  PLACED: "Order Place",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Top Selling Items-এর bar রঙ — Figma-র CSS export থেকে হুবহু, ক্রম
 * সহ। আগের মানগুলো (#F5943F, #6CC763, #A87BF5, #FF6FB5, #FF8B7A)
 * চোখে মেপে বসানো ছিল, প্রতিটাই এক-দু' ধাপ ফিকে।
 *
 * প্রথমটা Primary/100 — অর্থাৎ সবচেয়ে বেশি বিক্রির পদটা ব্র্যান্ডের
 * নিজের রঙ পায়, বাকিরা আলাদা করে চেনার জন্য।
 */
const BAR_COLORS = ["#FF9540", "#6DCB66", "#AE80FF", "#FF80B7", "#FF9580"];

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
     *  RangeSelect-এর মন্তব্য। */
    revenue?: string;
    /** Top Selling Items-এর নিজস্ব ছাঁকনি, chart-এর থেকে আলাদা। */
    top?: string;
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

  // Top Selling Items-এর নিজস্ব সময়কাল। শুধু শুরুর তারিখটা লাগে —
  // ওই কার্ডে খোপে ভাগ করার কিছু নেই, একটাই তালিকা।
  const topRange: RevenueRange = isRevenueRange(params.top) ? params.top : "week";
  const topStart = buildRevenueBuckets(topRange, now)[0].start;

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

  /**
   * Recent Orders তালিকার শর্ত — এই একই শর্ত export route-ও বানায়।
   *
   * ⚠️ খোঁজার অংশটা আর এখানে লেখা নেই, lib/order-search.ts-এ।
   * /admin/orders-এও হুবহু এই শর্তই দরকার, আর দুটো কপি থাকায় এতদিন
   * দুটোতেই অর্ডার আইডি খোঁজা যেত না — সংজ্ঞাটা এক জায়গায় থাকলে
   * এরকম আর হবে না।
   */
  const orderListWhere: Prisma.OrderWhereInput = {
    ...(listSince ? { createdAt: { gte: listSince } } : {}),
    ...(orderSearchFilter(q) ?? {}),
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
    // Top Selling Items — কার্ডের নিজের ছাঁকনি অনুযায়ী (?top=)।
    prisma.orderItem.findMany({
      where: { order: { ...notCancelled, createdAt: { gte: topStart } } },
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
      {/**
       * ফোনে stack, md (৭৬৮px) থেকে পাশাপাশি।
       *
       * ⚠️ ভাঙার বিন্দুটা `sm` (৬৪০) নয়, আর সেটাই মূল কথা। ৬৪০–৭৬৮
       * এর মাঝে দুটো পাশাপাশি রাখলে শিরোনামের জন্য পড়ে থাকে ~৩৫০px —
       * "Welcome Back, Md. Neaz Morshed!" ওখানে তিন লাইনে ভাঙে আর
       * Export বোতামটা কিনারা ছাড়িয়ে যায়। নামগুলো লম্বা হতে পারে,
       * তাই জায়গাটা উদারভাবে দেওয়াই নিরাপদ।
       *
       * `items-stretch` ফোনে: তারিখ আর Export একসাথে পুরো প্রস্থ
       * নেয়, ফলে বাঁ কিনারায় শিরোনামের সাথে সারিবদ্ধ থাকে।
       */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        {/**
         * Figma Typography: Sora, 600 SemiBold, 30px, line-height 100%,
         * letter-spacing 0%। রঙ Black/70 — #000000 @ 70% opacity, তাই
         * `text-black/70`; একটা কঠিন hex দিলে cream background-এ
         * (#F9F6F3) অন্যরকম বসত, কারণ opacity নিচের রঙটা মিশতে দেয়।
         *
         * ⚠️ `leading-none` কেবল md থেকে। Figma-র 100% line-height
         * এক লাইনের ৩০px শিরোনামের জন্য ঠিক, কিন্তু ৩৭৫px-এ লেখাটা
         * দু'লাইনে ভাঙে আর তখন ওই মানেই লাইন দুটো গায়ে গায়ে লেগে
         * যায় — "Welcome Back," আর নামের মাঝে কোনো শ্বাস থাকে না।
         * ছোট পর্দায় তাই `leading-tight`, আর মাপটাও ৩৭৫px-এ ২২।
         */}
        {/* min-w-0 — নাহলে লম্বা নাম flex item-টাকে তার পাত্রের চেয়েও
            চওড়া করে ফেলে আর ডান পাশের বোতাম বাইরে বেরিয়ে যায়। */}
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 sm:text-[26px] md:text-[30px] md:leading-none">
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

        {/**
         * ফোনে পুরো প্রস্থ আর দুই প্রান্তে ছড়ানো, md থেকে নিজের মাপে।
         *
         * ⚠️ তারিখের pill-এ আগে `flex-1` ছিল — বাকি জায়গা নিতে গিয়ে
         * ওটা নিজের লেখার চেয়েও সরু হয়ে যেত আর "Aug 28, 2026" দু'লাইনে
         * ভেঙে pill-টা উপচে পড়ত। এখন দুটোই নিজের মাপে (`shrink-0`),
         * আর ফাঁকটা `justify-between` সামলায়।
         *
         * ⚠️ `flex-wrap` লাগে ৩২০px-এর জন্য। দুটো মিলে ~৩২২px, অথচ
         * ওখানে padding বাদে থাকে ২৮৮ — `shrink-0` বলা আছে বলে কেউ
         * ছোট হয় না, তাই Export বোতামটা কেটে পর্দার বাইরে চলে যেত।
         * wrap থাকলে ওটা নিচের সারিতে নেমে যায়। ৩৭৫px-এ (আজকের সবচেয়ে
         * সাধারণ ছোট মাপ) দুটো এক সারিতেই আঁটে, তাই সেখানে wrap-এর
         * কোনো প্রভাব নেই।
         *
         * ছোট পর্দায় তারিখটা বছর ছাড়া ("Aug 28") — ৩২০px-এ ওটুকু
         * বাঁচানো মানে দুটো এক সারিতেই থেকে যাওয়া, আর বছরটা এমনিতেও
         * চলতি বছর, কেউ খোঁজে না।
         */}
        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 font-sora text-[14px] leading-none text-black">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span className="sm:hidden">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="hidden sm:inline">
              {now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
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
      {/* Figma card: Vertical, 1059×398, radius 20, padding 30, gap 20. */}
      <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Figma card title: Frank Ruhl Libre, 600 SemiBold, 30px,
              line-height 100%, #000000. তিনটে কার্ডেই একই। */}
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
            Recent Orders
          </h2>
          <DashboardFilters period={period} />
        </div>

        {/**
         * ⚠️ পুরো table-টা একটা cream বাক্সের ভেতরে — Figma:
         * BG #F9F6F3, radius 12, padding 16।
         *
         * আগে cream রঙটা কেবল header সারিতে ছিল আর কার্ডের প্রান্ত
         * থেকে প্রান্ত ছড়ানো, ফলে table-টা কার্ডের গায়ে সেঁটে থাকত।
         * বাক্সটা থাকলে table নিজেই একটা আলাদা তল হয়ে ওঠে, আর ১৬px
         * padding তাকে কিনারা থেকে সরিয়ে রাখে।
         */}
        <div className="overflow-x-auto rounded-[12px] bg-[#F9F6F3] p-4">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["No", "Order ID", "Customer Name", "Date & Time", "Order Status", "Amount"].map(
                  (heading) => (
                    /* Figma: Frank Ruhl Libre, 500 Medium, 20px, LH 100%,
                       #000000। শিরোনাম আর প্রথম সারির মাঝে 20px। */
                    <th
                      key={heading}
                      scope="col"
                      className="pb-5 pr-6 text-left font-frank-ruhl text-[20px] font-medium leading-none text-black last:pr-0"
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
                  <td colSpan={6} className="py-10 text-center font-sora text-[14px] text-black/70">
                    {q || period !== "all"
                      ? `No orders match this filter (${PERIOD_LABELS[period]}).`
                      : "No orders yet."}
                  </td>
                </tr>
              ) : (
                listOrders.map((order, index) => (
                  /* Figma: সারিতে সারিতে 18px ফাঁক, শেষেরটার নিচে কিছু নেই। */
                  <tr key={order.id} className="align-middle [&>td]:pb-[18px] last:[&>td]:pb-0">
                    {/* Figma: No কলামের সংখ্যা Frank Ruhl 400, 18px, Black/70। */}
                    <td className="pr-6 font-frank-ruhl text-[18px] font-normal leading-none text-black/70">
                      {rangeStart + index}
                    </td>
                    {/* বাকি সব ঘর: Sora 400, 16px, LH 100%, Black/70। */}
                    <td className="pr-6 font-sora text-[16px] leading-none text-black/70">
                      <Link href={`/admin/orders/${order.id}`} className="hover:underline">
                        {formatOrderId(order.id)}
                      </Link>
                    </td>
                    <td className="pr-6 font-sora text-[16px] leading-none text-black/70">
                      {order.user?.name ?? `${order.firstName} ${order.lastName}`}
                    </td>
                    <td className="pr-6 font-sora text-[16px] leading-none text-black/70">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="pr-6">
                      {/* Figma: pill 24px উঁচু, padding 6px 10px, radius 100,
                          লেখা Sora 400 12px। */}
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 font-sora text-[12px] font-normal leading-none ${
                          STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    {/* Figma: Amount Frank Ruhl 500, 18px, #000000 — আর
                        বাঁ-ঘেঁষা, ডানে নয় (column-এর align flex-start)। */}
                    <td className="font-frank-ruhl text-[18px] font-medium leading-none text-black">
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

        {/* Figma: row, space-between, উচ্চতা 34। */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Figma: 6px কমলা বিন্দু + Sora 400 12px Black/70, gap 6। */}
          <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-black/70">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" aria-hidden="true" />
            Showing <span className="font-semibold text-black">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-black">{listTotal}</span> Transactions
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
      {/* Figma card: Vertical, 1059×266, radius 20, padding 30, gap 24. */}
      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
            Kitchen Inventory
          </h2>

          {/**
           * ⚠️ Figma-তে এখানে একটা "Today ⌄" dropdown আঁকা, কিন্তু সেটা
           * বসানো হয়নি — ইচ্ছাকৃতভাবে।
           *
           * নিচের চারটে সংখ্যার তিনটেই (Total Items, Low Stock, Out of
           * Stock) গুদামের *এই মুহূর্তের* অবস্থা, কোনো সময়কালের হিসাব
           * নয়। "This Year" বাছলে সংখ্যা এক চুলও বদলাত না, অথচ
           * ব্যবহারকারী ভাবতেন বদলেছে — একটা ছাঁকনি যেটা কিছুই ছাঁকে না,
           * সেটা না থাকার চেয়েও খারাপ।
           *
           * Designer সম্ভবত পাশের কার্ড থেকে frame-টা copy করেছেন:
           * CSS export-এ শিরোনামের layer-এর নাম এখনো "Resent Orders",
           * আর hint-এর লেখা "VS last Week"।
           *
           * তাই কাজের link-টাই রাখা হয়েছে, শুধু pill-এর গড়নটা Figma-র:
           * 40px উঁচু, radius 100, BG #F9F6F3, Sora 400 14px।
           */}
          <Link
            href="/admin/inventory"
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#F9F6F3] px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black/[0.06]"
          >
            Manage stock →
          </Link>
        </div>

        {/* Figma: row, gap 20, প্রতিটা card flex-grow 1। */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {inventoryStats.map((item) => (
            /* Figma card: column, 142px উঁচু, radius 16, padding 16,
               gap 20, BG #F9F6F3।
               উচ্চতাটা মিলিয়ে দেখার মতো:
               16 + 40 (উপরের সারি) + 20 + 50 (নিচের ব্লক) + 16 = 142। */
            <div
              key={item.label}
              className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Figma: Frank Ruhl Libre, 500 Medium, 20px, #000000।
                    আগে 18px semibold #121212 ছিল। */}
                <h3 className="font-frank-ruhl text-[20px] font-medium leading-none text-black">
                  {item.label}
                </h3>
                {/* ⚠️ Figma-তে icon-টা একটা 40×40 সাদা বৃত্তের ভেতরে,
                    icon নিজে 18×18 কালো, stroke 1.2। আগে বৃত্তটাই ছিল
                    না আর icon ধূসর — তাই cream পটভূমিতে ওটা মিলিয়ে
                    যাচ্ছিল। */}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <item.icon
                    className="h-[18px] w-[18px] text-black"
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                </span>
              </div>

              {/* Figma: column, gap 12। */}
              <div className="flex flex-col gap-3">
                {/* Figma: Frank Ruhl Libre, 600 SemiBold, 24px, #000000।
                    আগে 26px bold #121212। */}
                <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {item.value}
                </p>
                {/* Figma: Sora 400, 12px, Black/70। */}
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">
                  {item.hint}
                </p>
              </div>
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
            <RangeSelect param="revenue" range={revenueRange} />
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

        {/* Figma card: Vertical, 517.5×356, radius 20, padding 30, gap 20. */}
        <div className="flex flex-col gap-5 rounded-[20px] bg-white p-5 md:p-[30px]">
          {/* Header — Figma: row, space-between, height 40, gap 20. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
              Top Selling Items
            </h2>
            <RangeSelect param="top" range={topRange} />
          </div>

          {topItems.length === 0 ? (
            <p className="font-sora text-[14px] text-black/70">
              No sales in this period yet.
            </p>
          ) : (
            /* Figma: column, gap 16। */
            <div className="flex flex-col gap-4">
              {topItems.map((item, index) => (
                /* Row — Figma: row, align center, gap 20, height 32
                   (নাম দু'লাইন হলে 36)। */
                <div key={item.title} className="flex items-center gap-3 md:gap-5">
                  {/* Figma: বাঁ দলটার ভেতরে gap 30। */}
                  <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-[30px]">
                    {/* ক্রম + নাম — Figma: gap 16, মোট চওড়া 113। */}
                    <div className="flex w-[104px] shrink-0 items-center gap-4 md:w-[113px]">
                      <span className="font-frank-ruhl text-[14px] font-normal leading-none text-black">
                        {index + 1}
                      </span>
                      {/* Figma: Sora 400, 14px, line-height 130%, চওড়া 90 —
                          অর্থাৎ লম্বা নাম দু'লাইনে ভাঙাই নকশার অভিপ্রায়
                          ("Crispy Fried Chicken")। truncate দিলে উল্টো
                          মকআপের সাথে মিলত না। */}
                      <span className="w-[90px] font-sora text-[14px] font-normal leading-[1.3] text-black">
                        {item.title}
                      </span>
                    </div>

                    {/* Track — Figma: height 32, radius 100, BG #F9F6F3,
                        ভেতরে সাদা তির্যক ডোরা 60%। ভরাট অংশটা এর উপরে
                        বসে, তাই ডোরা কেবল খালি জায়গাতেই দেখা যায়। */}
                    <div
                      className="h-8 min-w-0 flex-1 overflow-hidden rounded-full"
                      style={{
                        backgroundColor: "#F9F6F3",
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(255,255,255,0.6) 0 2px, transparent 2px 14px)",
                      }}
                    >
                      <div
                        className="flex h-8 items-center justify-end rounded-full pr-2.5"
                        style={{
                          // অনুপাতে চওড়া, তবে ন্যূনতম ৯৬px — নাহলে ছোট
                          // অঙ্কের bar-এর ভেতরে টাকার লেখাটাই আঁটত না।
                          // শতাংশে ন্যূনতম দিলে সরু কার্ডে সেটা আবার
                          // যথেষ্ট হতো না, তাই px।
                          width: `${(item.revenue / maxItemRevenue) * 100}%`,
                          minWidth: "96px",
                          backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                        }}
                      >
                        <span className="font-frank-ruhl text-[14px] font-medium leading-none text-white">
                          {money(item.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Figma: 83×32 pill, radius 100, BG #F9F6F3,
                      লেখা Sora 400 12px #000000। */}
                  <span className="flex h-8 w-[83px] shrink-0 items-center justify-center rounded-full bg-[#F9F6F3] font-sora text-[12px] font-normal leading-none text-black">
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