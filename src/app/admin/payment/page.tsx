import { type ReactNode } from "react";
import { Calendar, CircleCheck, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmount } from "@/lib/currency-format";
import { orderSearchFilter } from "@/lib/order-search";
import {
  DEFAULT_PAYMENT_STATUS,
  DEFAULT_SUMMARY_RANGE,
  isPaymentStatus,
  isSummaryRange,
  summaryRangeStart,
  type PaymentStatusFilter,
  type SummaryRange,
} from "@/lib/payment-filters";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "@/app/admin/orders/Pagination";
import PaymentsToolbar from "./PaymentsToolbar";
import SummaryRangeMenu from "./SummaryRangeMenu";

export const metadata = { title: "Payment" };

const PAGE_SIZE = 5;

/**
 * /admin/payment — Figma "Payment" পাতা।
 *
 *   Welcome header + তারিখ + Export Report
 *   খোঁজার ঘর + "All Statuses"
 *   Overview:            Total Revenue · Successful Payments
 *   Payment Summary:     মাধ্যম অনুযায়ী (Online / Cash on Delivery)
 *   Shipping Summary:    ডেলিভারির মাধ্যম অনুযায়ী
 *   Recent Transactions: তালিকা + পাতা বদল
 *
 * ── টাকার হিসাবের নিয়ম ─────────────────────────────────────────────
 *
 * ⚠️ আয় গোনা হয় কেবল সেই অর্ডারগুলোর যেগুলোর টাকা সত্যিই এসেছে —
 * `paymentStatus` PAID বা PARTIALLY_REFUNDED। PENDING (এখনো দেয়নি),
 * FAILED (কার্ড আটকেছে) আর REFUNDED (পুরো টাকা ফেরত) বাদ। নাহলে
 * পরিত্যক্ত checkout আর ফেরত দেওয়া টাকাও "Total Revenue"-তে যোগ হয়ে
 * সংখ্যাটা ফুলিয়ে দিত, আর সেই সংখ্যা দেখেই ব্যবসার সিদ্ধান্ত হয়।
 *
 * ⚠️ যোগ হয় `grandTotal − refundedAmount`, শুধু grandTotal নয়। আংশিক
 * ফেরত দেওয়া অর্ডারে (একটা ভুল পদ ফেরত) পুরো টাকাটা এখনো আমাদের কাছে
 * আছে ধরে নেওয়া মিথ্যা হতো।
 *
 * ⚠️ মুদ্রা একটাই ধরা হয়েছে — গোটা অ্যাপ জুড়ে দাম, ফি আর কর একটাই
 * রেস্তোরাঁর settings থেকে আসে। তবু "$" হাতে জুড়ে দেওয়া হয়নি:
 * সাম্প্রতিকতম অর্ডারের `currency` থেকে নেওয়া হয়, যাতে settings-এ
 * মুদ্রা বদলালে এই পাতাও নিজে থেকেই বদলায়।
 */
export default async function AdminPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; summary?: string }>;
}) {
  // layout.tsx-ও `requireStaff("refunds")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("refunds");
  const params = await searchParams;

  const q = params.q?.trim();
  const status: PaymentStatusFilter = isPaymentStatus(params.status)
    ? params.status
    : DEFAULT_PAYMENT_STATUS;
  const summary: SummaryRange = isSummaryRange(params.summary)
    ? params.summary
    : DEFAULT_SUMMARY_RANGE;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const now = new Date();

  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL"
      ? { paymentStatus: status as Prisma.OrderWhereInput["paymentStatus"] }
      : {}),
    ...(orderSearchFilter(q) ?? {}),
  };

  /**
   * "টাকা সত্যিই এসেছে" — একটাই সংজ্ঞা, সব হিসাবে ব্যবহার হয়। আলাদা
   * করে লিখলে কোনো এক জায়গায় REFUNDED বাদ দিতে ভুলে যাওয়া সময়ের ব্যাপার।
   */
  const SETTLED: Prisma.OrderWhereInput = {
    paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] },
  };

  // Overview-র তুলনার জন্য দুটো সাত দিনের জানালা: এই সপ্তাহ, তার আগেরটা।
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);

  const summaryStart = summaryRangeStart(summary);
  const summaryWhere: Prisma.OrderWhereInput = {
    ...SETTLED,
    ...(summaryStart ? { createdAt: { gte: summaryStart } } : {}),
  };

  const [
    settledTotals,
    settledCount,
    thisWeek,
    prevWeek,
    thisWeekCount,
    prevWeekCount,
    byPaymentMethod,
    byShippingMethod,
    dineInSummary,
    transactions,
    totalCount,
    latestOrder,
  ] = await Promise.all([
    prisma.order.aggregate({ where: SETTLED, _sum: { grandTotal: true, refundedAmount: true } }),
    prisma.order.count({ where: SETTLED }),
    prisma.order.aggregate({
      where: { ...SETTLED, createdAt: { gte: weekStart } },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...SETTLED, createdAt: { gte: prevWeekStart, lt: weekStart } },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.count({ where: { ...SETTLED, createdAt: { gte: weekStart } } }),
    prisma.order.count({
      where: { ...SETTLED, createdAt: { gte: prevWeekStart, lt: weekStart } },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: summaryWhere,
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.groupBy({
      by: ["shippingMethod"],
      where: { ...summaryWhere, orderType: "DELIVERY" },
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    // ⚠️ dine-in আলাদা করে গোনা হয়, কারণ ওগুলোর `shippingMethod` null —
    // উপরের groupBy-তে রাখলে তালিকায় একটা "—" নামের সারি দেখা যেত।
    prisma.order.aggregate({
      where: { ...summaryWhere, orderType: "DINE_IN" },
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        orderType: true,
        shippingMethod: true,
        paymentMethod: true,
        paymentStatus: true,
        grandTotal: true,
        refundedAmount: true,
        currency: true,
        currencyMinorUnits: true,
        user: { select: { name: true } },
        table: { select: { label: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { currency: true, currencyMinorUnits: true },
    }),
  ]);

  const currency = latestOrder?.currency ?? "USD";
  const minorUnits = latestOrder?.currencyMinorUnits ?? 2;

  const net = (sum: {
    grandTotal: Prisma.Decimal | null;
    refundedAmount: Prisma.Decimal | null;
  }) => (sum.grandTotal ?? new Prisma.Decimal(0)).minus(sum.refundedAmount ?? 0);

  const money = (value: Prisma.Decimal) => formatAmount(value.toFixed(minorUnits), currency);

  const totalRevenue = net(settledTotals._sum);
  const revenueTrend = percentChange(net(thisWeek._sum), net(prevWeek._sum));
  const paymentsTrend = percentChange(
    new Prisma.Decimal(thisWeekCount),
    new Prisma.Decimal(prevWeekCount)
  );

  const paymentRows = byPaymentMethod
    .map((row) => ({
      key: row.paymentMethod,
      label: row.paymentMethod === "COD" ? "Cash on Delivery" : "Online",
      transactions: row._count._all,
      revenue: net(row._sum),
    }))
    .sort((a, b) => b.revenue.comparedTo(a.revenue));

  const shippingRows = [
    ...byShippingMethod.map((row) => ({
      key: row.shippingMethod ?? "UNKNOWN",
      label: shippingLabel(row.shippingMethod),
      transactions: row._count._all,
      revenue: net(row._sum),
    })),
    ...(dineInSummary._count._all > 0
      ? [
          {
            key: "DINE_IN",
            label: "Dine-in",
            transactions: dineInSummary._count._all,
            revenue: net(dineInSummary._sum),
          },
        ]
      : []),
  ].sort((a, b) => b.revenue.comparedTo(a.revenue));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = (page - 1) * PAGE_SIZE + transactions.length;

  return (
    <div className="space-y-4">
      {/* --- Welcome header — Orders/Kitchen/Staff-এর হুবহু একই গড়ন --- */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>

          {/* ⚠️ `page` আর `summary` forward হয় না: export মানে পুরো ছাঁকা
              তালিকা, পর্দার পাঁচটা সারি নয়; আর summary কেবল উপরের
              কার্ডগুলো বদলায়, তালিকার একটা সারিও নয়। */}
          <ExportReportButton
            endpoint="/api/admin/payments/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-payments.csv"
          />
        </div>
      </div>

      <PaymentsToolbar status={status} />

      {/* --- Overview --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Overview
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="Total Revenue"
            value={money(totalRevenue)}
            hint="Revenue from settled payments"
            trend={revenueTrend}
            icon={<Coins className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="Successful Payments"
            value={String(settledCount)}
            hint="Completed transactions"
            trend={paymentsTrend}
            icon={
              <CircleCheck className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            }
          />
        </div>
      </section>

      {/* --- Payment Summary --- */}
      <SummarySection title="Payment Summary" range={summary} rows={paymentRows} money={money} />

      {/* --- Shipping Summary --- */}
      <SummarySection title="Shipping Summary" range={summary} rows={shippingRows} money={money} />

      {/* --- Recent Transactions --- */}
      <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Recent Transactions
          </h2>
          <span className="shrink-0 font-sora text-[12px] leading-none text-black/70 min-[480px]:text-[14px]">
            {totalCount} {totalCount === 1 ? "transaction" : "transactions"}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
            No transactions match that search or filter.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {transactions.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-6"
              >
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 min-[640px]:grid-cols-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.8fr)] xl:items-center xl:gap-x-6">
                  <Field label="Customer">
                    <span className="truncate font-sora text-[13px] leading-none text-black">
                      {order.user?.name ?? `${order.firstName} ${order.lastName}`.trim()}
                    </span>
                  </Field>
                  <Field label="Order ID">
                    <span className="truncate font-sora text-[13px] font-medium leading-none text-black">
                      {formatOrderId(order.id)}
                    </span>
                  </Field>
                  <Field label="Delivery">
                    <span className="truncate font-sora text-[13px] leading-none text-black/70">
                      {order.orderType === "DINE_IN"
                        ? `Table - ${order.table?.label ?? "—"}`
                        : shippingLabel(order.shippingMethod)}
                    </span>
                  </Field>
                  <Field label="Payment Method">
                    <span className="truncate font-sora text-[13px] leading-none text-black/70">
                      {order.paymentMethod === "COD"
                        ? order.orderType === "DINE_IN"
                          ? "Pay at Table"
                          : "Cash on Delivery"
                        : "Online"}
                    </span>
                  </Field>
                  <Field label="Order Placed">
                    <span className="truncate font-sora text-[13px] leading-none text-black/70">
                      {order.createdAt.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                      {", "}
                      {order.createdAt.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </Field>
                  <Field label="Amount">
                    <span className="truncate font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                      {formatAmount(
                        order.grandTotal
                          .minus(order.refundedAmount)
                          .toFixed(order.currencyMinorUnits),
                        order.currency
                      )}
                    </span>
                  </Field>
                </div>

                <div className="shrink-0 xl:w-[150px]">
                  <Field label="Status">
                    <PaymentBadge status={order.paymentStatus} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalCount > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <span className="font-sora text-[12px] leading-none text-black/70 min-[480px]:text-[14px]">
              Showing {firstRow}–{lastRow} of {totalCount}
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={params}
              basePath="/admin/payment"
            />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * শতকরা পরিবর্তন — Figma-র "+4% week" ব্যাজ।
 *
 * ⚠️ আগের সপ্তাহে কিছুই না থাকলে (০) কোনো ব্যাজই দেখানো হয় না, "+100%"
 * নয়। শূন্য থেকে বাড়াকে শতাংশে প্রকাশ করা যায় না, আর "+100%" লিখলে
 * সেটা একটা অর্থপূর্ণ তুলনা বলে ভুল বোঝাত — বিশেষ করে নতুন রেস্তোরাঁর
 * প্রথম সপ্তাহে, যখন সব কিছুরই আগের মান শূন্য।
 */
function percentChange(current: Prisma.Decimal, previous: Prisma.Decimal): number | null {
  if (previous.lessThanOrEqualTo(0)) return null;
  return Math.round(current.minus(previous).dividedBy(previous).times(100).toNumber());
}

function shippingLabel(method: string | null) {
  if (method === "UBER_EATS") return "Uber Eats";
  if (method === "FOOD_PANDA") return "Food Panda";
  if (method === "OWN_DELIVERY") return "Our Own Delivery";
  return "—";
}

/** Figma "Card": cream, radius 16, padding 16, gap 20। */
function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  trend: number | null;
  icon: ReactNode;
}) {
  const up = trend !== null && trend >= 0;

  return (
    <div className="flex flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">
            {value}
          </span>

          {trend !== null && (
            <span
              className={`flex h-[26px] items-center gap-1 rounded-full px-[6px] font-sora text-[13px] leading-none xl:text-[14px] ${
                up ? "bg-[#E8FFEC] text-[#0ECF00]" : "bg-[#FFECEC] text-[#D72A37]"
              }`}
            >
              {up ? (
                <TrendingUp className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden="true" />
              ) : (
                <TrendingDown className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden="true" />
              )}
              {up ? "+" : ""}
              {trend}% week
            </span>
          )}
        </div>

        <span className="font-sora text-[12px] leading-none text-black/70">
          {hint}
          {trend !== null && " · vs last week"}
        </span>
      </div>
    </div>
  );
}

/** "Payment Summary" আর "Shipping Summary" — একই গড়ন, আলাদা সারি। */
function SummarySection({
  title,
  range,
  rows,
  money,
}: {
  title: string;
  range: SummaryRange;
  rows: { key: string; label: string; transactions: number; revenue: Prisma.Decimal }[];
  money: (value: Prisma.Decimal) => string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          {title}
        </h2>
        <SummaryRangeMenu value={range} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
          No settled payments in this period yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[16px] bg-[#F9F6F3] p-4 md:grid-cols-3"
            >
              <Field label={title === "Payment Summary" ? "Payment Method" : "Shipping Method"}>
                <span className="truncate font-sora text-[13px] font-medium leading-none text-black">
                  {row.label}
                </span>
              </Field>
              <Field label="Transactions">
                <span className="truncate font-sora text-[13px] leading-none text-black/70">
                  {row.transactions}
                </span>
              </Field>
              <Field label="Revenue">
                <span className="truncate font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                  {money(row.revenue)}
                </span>
              </Field>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Figma-র সবুজ "Paid" ব্যাজ, বাকি অবস্থাগুলো নিজস্ব রঙে।
 *
 * ⚠️ শুধু সবুজ আর ধূসর রাখা হয়নি: ফেরত দেওয়া টাকা আর ব্যর্থ কার্ড দুটো
 * খুব আলাদা ব্যাপার, আর দুটোতেই কারও কিছু করার থাকে। এক রঙে দেখালে
 * তালিকায় চোখ বুলিয়ে সেটা ধরা যেত না।
 */
function PaymentBadge({ status }: { status: string }) {
  const STYLES: Record<string, { label: string; className: string }> = {
    PAID: { label: "Paid", className: "bg-[#E8FFEC] text-[#0ECF00]" },
    PENDING: { label: "Pending", className: "bg-[#FDF3DC] text-[#F3A42F]" },
    FAILED: { label: "Failed", className: "bg-[#FFECEC] text-[#D72A37]" },
    PARTIALLY_REFUNDED: { label: "Part. refunded", className: "bg-[#E9E0FD] text-[#530EF8]" },
    REFUNDED: { label: "Refunded", className: "bg-[#E6EDFE] text-[#3A8DFA]" },
  };

  const style = STYLES[status] ?? { label: status, className: "bg-black/5 text-black/70" };

  return (
    <span
      className={`inline-flex h-[30px] items-center justify-center rounded-full px-4 font-sora text-[12px] font-semibold leading-none ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** লেবেল + মান — Orders পাতার `Field`-এর হুবহু একই গড়ন। */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="truncate font-sora text-[12px] leading-none text-black/70">{label}</span>
      {children}
    </div>
  );
}
