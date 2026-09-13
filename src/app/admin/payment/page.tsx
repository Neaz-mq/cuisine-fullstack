import { type ReactNode } from "react";
import { Calendar, CircleCheck, Coins, TrendingDown, TrendingUp } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { formatOrderId } from "@/lib/format-order-id";
import { formatAmount } from "@/lib/currency-format";
import { orderSearchFilter } from "@/lib/order-search";
import {
  DEFAULT_OVERVIEW_RANGE,
  DEFAULT_PAYMENT_STATUS,
  DEFAULT_SUMMARY_RANGE,
  overviewWindows,
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
import OverviewRangeMenu from "./OverviewRangeMenu";
import MethodManagerModal from "./MethodManagerModal";
import OrderItemsModal from "./OrderItemsModal";
import {
  getTransactionMethods,
  type TransactionMethod as TransactionMethodConfig,
} from "@/lib/transaction-methods";

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
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    overview?: string;
    payRange?: string;
    shipRange?: string;
  }>;
}) {
  // layout.tsx-ও `requireStaff("refunds")` ডাকে; এখানে আবার ডাকা হয়
  // session-টার জন্য (নাম দেখাতে), আর সেটাই একমাত্র কারণ।
  const session = await requireStaff("refunds");
  const params = await searchParams;

  const q = params.q?.trim();
  const status: PaymentStatusFilter = isPaymentStatus(params.status)
    ? params.status
    : DEFAULT_PAYMENT_STATUS;
  /**
   * ⚠️ দুটো সারাংশের দুটো আলাদা ছাঁকনি।
   *
   * আগে দুটোই একটা `summary` parameter ভাগ করত, তাই একটা pill বদলালে
   * অন্যটাও বদলে যেত — যেটা staff-এর কাছে একটা bug-এর মতোই লাগে।
   */
  const overviewRange: SummaryRange = isSummaryRange(params.overview)
    ? params.overview
    : DEFAULT_OVERVIEW_RANGE;
  const payRange: SummaryRange = isSummaryRange(params.payRange)
    ? params.payRange
    : DEFAULT_SUMMARY_RANGE;
  const shipRange: SummaryRange = isSummaryRange(params.shipRange)
    ? params.shipRange
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

  const windows = overviewWindows(overviewRange);

  const overviewWhere: Prisma.OrderWhereInput = {
    ...SETTLED,
    ...(windows.totalStart ? { createdAt: { gte: windows.totalStart } } : {}),
  };
  // growth ব্যাজের দুটো জানালা — বিস্তারিত lib/payment-filters.ts-এ।
  const trendWhere: Prisma.OrderWhereInput = {
    ...SETTLED,
    createdAt: { gte: windows.trendStart },
  };
  const previousWhere: Prisma.OrderWhereInput = {
    ...SETTLED,
    createdAt: { gte: windows.trendPrevious, lt: windows.trendStart },
  };

  const settledSince = (range: SummaryRange): Prisma.OrderWhereInput => {
    const start = summaryRangeStart(range);
    return { ...SETTLED, ...(start ? { createdAt: { gte: start } } : {}) };
  };

  const payWhere = settledSince(payRange);
  const shipWhere = settledSince(shipRange);

  const [
    settledTotals,
    settledCount,
    trendTotals,
    previousTotals,
    trendCount,
    previousCount,
    byPaymentMethod,
    byShippingMethod,
    dineInSummary,
    methodSettings,
    transactions,
    totalCount,
    latestOrder,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: overviewWhere,
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.count({ where: overviewWhere }),
    prisma.order.aggregate({
      where: trendWhere,
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.aggregate({
      where: previousWhere,
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.count({ where: trendWhere }),
    prisma.order.count({ where: previousWhere }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: payWhere,
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    prisma.order.groupBy({
      by: ["shippingMethod"],
      where: { ...shipWhere, orderType: "DELIVERY" },
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    // ⚠️ dine-in আলাদা করে গোনা হয়, কারণ ওগুলোর `shippingMethod` null —
    // উপরের groupBy-তে রাখলে তালিকায় একটা "—" নামের সারি দেখা যেত।
    prisma.order.aggregate({
      where: { ...shipWhere, orderType: "DINE_IN" },
      _count: { _all: true },
      _sum: { grandTotal: true, refundedAmount: true },
    }),
    // admin-এর দেওয়া নাম আর চালু/বন্ধ (lib/transaction-methods.ts) —
    // সারাংশের লেবেলগুলো এখান থেকেই আসে, হাতে লেখা string থেকে নয়।
    getTransactionMethods(),
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
        // "View" modal-এর জন্য — Figma-র "Order Items"। তালিকার প্রতিটা
        // সারির সাথেই আসে, কারণ modal খোলার পর আলাদা request পাঠালে
        // staff-কে প্রতিবার এক মুহূর্ত অপেক্ষা করতে হতো।
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            menuItem: { select: { title: true } },
          },
        },
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
  const revenueTrend = percentChange(net(trendTotals._sum), net(previousTotals._sum));
  const paymentsTrend = percentChange(
    new Prisma.Decimal(trendCount),
    new Prisma.Decimal(previousCount)
  );

  /**
   * ⚠️ লেবেলগুলো admin-এর সেটিং থেকে, হাতে লেখা নয়। কেউ "Cash on
   * Delivery"-র নাম বদলে "ক্যাশ অন ডেলিভারি" করলে checkout, রিপোর্ট আর
   * এই সারাংশ — তিন জায়গাতেই একই নাম দেখা উচিত।
   */
  const labelFor = (kind: "payment" | "shipping", code: string) =>
    methodSettings[kind].find((method) => method.code === code)?.label;

  const paymentRows = byPaymentMethod
    .map((row) => ({
      key: row.paymentMethod,
      label: labelFor("payment", row.paymentMethod) ?? row.paymentMethod,
      transactions: row._count._all,
      revenue: net(row._sum),
    }))
    .sort((a, b) => b.revenue.comparedTo(a.revenue));

  /**
   * "Add Method" দিয়ে যোগ করা নামগুলো তালিকার শেষে।
   *
   * ⚠️ এগুলোর লেনদেন সবসময় ০, আর সেটা লুকানো হয় না — `custom: true`
   * দিয়ে সারিতে একটা ছোট টীকা বসে। কারণ এই নামগুলো checkout-এ যায় না
   * (PaymentMethod/ShippingMethod enum দুটো কেবল migration-এ বাড়ে), তাই
   * "০ লেনদেন" দেখে staff যেন ভাবেন না যে কেউ ব্যবহার করছে না — বরং
   * জানেন যে এখনো ব্যবহারই করা যায় না।
   */
  const shippingRows = [
    ...byShippingMethod.map((row) => ({
      key: row.shippingMethod ?? "UNKNOWN",
      label:
        (row.shippingMethod ? labelFor("shipping", row.shippingMethod) : null) ??
        shippingLabel(row.shippingMethod),
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
      <section className="flex flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
        {/* Figma "Frame 2147236238": শিরোনাম বাঁয়ে, সময়ের pill ডানে —
            বাকি দুটো সারাংশ কার্ডের মতোই। */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Overview
          </h2>
          <OverviewRangeMenu value={overviewRange} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            label="Total Revenue"
            value={money(totalRevenue)}
            hint={windows.totalStart ? "Revenue in this period" : "Revenue from settled payments"}
            trendHint={windows.hint}
            trend={revenueTrend}
            icon={<Coins className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />}
          />
          <StatCard
            label="Successful Payments"
            value={String(settledCount)}
            hint="Completed transactions"
            trendHint={windows.hint}
            trend={paymentsTrend}
            icon={
              <CircleCheck className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            }
          />
        </div>
      </section>

      {/* --- Payment Summary --- */}
      <SummarySection
        title="Payment Summary"
        rowLabel="Payment Method"
        range={payRange}
        rangeParam="payRange"
        kind="PAYMENT"
        methods={methodSettings.payment}
        rows={paymentRows}
        money={money}
      />

      {/* --- Shipping Summary --- */}
      <SummarySection
        title="Shipping Summary"
        rowLabel="Shipping Method"
        range={shipRange}
        rangeParam="shipRange"
        kind="SHIPPING"
        methods={methodSettings.shipping}
        rows={shippingRows}
        money={money}
      />

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
                /**
                 * ⚠️ সব ঘর — Status আর View সহ — একটাই grid-এ।
                 *
                 * আগে ছয়টা ঘর একটা grid-এ ছিল আর Status/View আলাদা flex
                 * ব্লকে। ওই ব্লকটার চওড়াই তার ভেতরের ব্যাজের উপর নির্ভর
                 * করত ("Pending" লেখাটা "Paid"-এর চেয়ে চওড়া), তাই প্রতি
                 * সারিতে grid-এর ভাগে পড়া জায়গা একটু করে বদলাত — ফলে
                 * কলামগুলো সারি ধরে সামান্য এদিক-ওদিক সরে যেত, আর
                 * "Our Own Delivery" কোথাও কেটে "Our Own Deliv…" হতো।
                 *
                 * শেষ দুটো কলাম স্থির px-এ, তাই ব্যাজ যত চওড়াই হোক
                 * বাকি ছয়টা কলামের মাপ প্রতিটা সারিতে হুবহু এক।
                 */
                className="rounded-[16px] bg-[#F9F6F3] p-4 xl:min-h-[94px]"
              >
                <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 min-[640px]:grid-cols-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_112px_84px] xl:gap-x-6">
                  <Field label="Customer" size="sm">
                    <span className={VALUE_SM}>
                      {order.user?.name ?? `${order.firstName} ${order.lastName}`.trim()}
                    </span>
                  </Field>
                  <Field label="Order ID" size="sm">
                    <span className={VALUE_SM}>{formatOrderId(order.id)}</span>
                  </Field>
                  <Field label="Delivery" size="sm">
                    <span className={VALUE_SM}>
                      {order.orderType === "DINE_IN"
                        ? `Table - ${order.table?.label ?? "—"}`
                        : ((order.shippingMethod
                            ? labelFor("shipping", order.shippingMethod)
                            : null) ?? shippingLabel(order.shippingMethod))}
                    </span>
                  </Field>
                  <Field label="Payment Method" size="sm">
                    {/* ⚠️ নামটা admin-এর সেটিং থেকে — "Manage Methods"-এ
                        বদলালে এখানেও সেই নামই দেখা উচিত। */}
                    <span className={VALUE_SM}>
                      {labelFor("payment", order.paymentMethod) ?? order.paymentMethod}
                    </span>
                  </Field>
                  <Field label="Order Placed" size="sm">
                    <span className={VALUE_SM}>
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
                  <Field label="Amount" size="sm">
                    <span className={VALUE_SM}>
                      {formatAmount(
                        order.grandTotal
                          .minus(order.refundedAmount)
                          .toFixed(order.currencyMinorUnits),
                        order.currency
                      )}
                    </span>
                  </Field>

                  {/**
                    * ⚠️ ছোট পর্দায় ঘরটা দুই কলাম জুড়ে, আর ব্যাজটা পুরো
                    * চওড়া — ঠিক নিচের "View" বোতামের মতো। ৩২০px-এ অর্ধেক
                    * কলামে একটা ছোট ব্যাজ আর তার নিচে পুরো চওড়া একটা
                    * বোতাম দেখতে অগোছালো লাগত।
                    *
                    * ⚠️ `self-end` — বড় পর্দায় Status ঘরটা সবচেয়ে উঁচু
                    * (লেবেল + ৩৪px ব্যাজ), তাই পাশের বোতামটাও একই নিচের
                    * রেখায় বসে। grid-এর `items-center` থাকলে বোতামটা
                    * মাঝখানে ঝুলে থাকত।
                    */}
                  <Field label="Status" size="sm" className="col-span-2 min-[640px]:col-span-1">
                    <PaymentBadge status={order.paymentStatus} />
                  </Field>

                  {/* ⚠️ বোতামটা লেবেলহীন একটা ঘর — উপরে ফাঁকা জায়গাটা
                      পাশের "Status" লেবেলের সমান, তাই বোতামটা অন্য
                      সারির মানগুলোর সাথে এক রেখায় বসে। */}
                  <div className="col-span-2 flex self-end min-[640px]:col-span-1">
                  <OrderItemsModal
                    reference={formatOrderId(order.id)}
                    items={order.items.map((item) => ({
                      id: item.id,
                      title: item.menuItem.title,
                      quantity: item.quantity,
                      // ⚠️ লাইন-মোট (একক × পরিমাণ), একক দাম নয় — Figma-তে
                      // "Chocolate Fudge Cake × 1 … $95.00" মানে ওই লাইনের
                      // মোট। গুণটা server-এ, Decimal-এ, তাই ভগ্নাংশে
                      // গোলমাল হয় না।
                      lineTotal: formatAmount(
                        item.price.times(item.quantity).toFixed(order.currencyMinorUnits),
                        order.currency
                      ),
                    }))}
                    channelLabel={
                      order.orderType === "DINE_IN"
                        ? `Table - ${order.table?.label ?? "—"}`
                        : (labelFor("shipping", order.shippingMethod ?? "") ??
                          shippingLabel(order.shippingMethod))
                    }
                    paymentLabel={
                      labelFor("payment", order.paymentMethod) ?? order.paymentMethod
                    }
                    totalLabel={formatAmount(
                      order.grandTotal
                        .minus(order.refundedAmount)
                        .toFixed(order.currencyMinorUnits),
                      order.currency
                    )}
                  />
                  </div>
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
/**
 * Figma "Card" (Frame 2147232365 + 2147232366):
 *
 *   cream, radius 16, padding 16, gap 20, উচ্চতা 142
 *   উপরে: শিরোনাম 20px Frank Ruhl medium | 40px সাদা গোলে আইকন
 *   নিচে: মান 24px semibold + সবুজ pill ("+4% week"), তারপর 12px টীকা
 */
function StatCard({
  label,
  value,
  hint,
  trend,
  trendHint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  trend: number | null;
  /** "vs last week" / "vs yesterday" — কোন সময়ের সাথে তুলনা। */
  trendHint?: string;
  icon: ReactNode;
}) {
  const up = trend !== null && trend >= 0;

  return (
    <div className="flex min-h-[142px] flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-medium leading-none text-black xl:text-[20px]">
          {label}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-frank-ruhl text-[22px] font-semibold leading-none text-black xl:text-[24px]">
            {value}
          </span>

          {/* ⚠️ আগের সময়সীমায় কিছু না থাকলে ব্যাজটাই থাকে না — শূন্য
              থেকে বাড়াকে শতাংশে প্রকাশ করা যায় না (percentChange
              দ্রষ্টব্য)। */}
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
              {trend}%
            </span>
          )}
        </div>

        <span className="font-sora text-[12px] leading-none text-black/70">
          {trend !== null && trendHint ? trendHint : hint}
        </span>
      </div>
    </div>
  );
}

/** "Payment Summary" আর "Shipping Summary" — একই গড়ন, আলাদা সারি। */
function SummarySection({
  title,
  rowLabel,
  range,
  rangeParam,
  kind,
  methods,
  rows,
  money,
}: {
  title: string;
  /** প্রতিটা সারির প্রথম ঘরের লেবেল — "Payment Method" / "Shipping Method"। */
  rowLabel: string;
  range: SummaryRange;
  rangeParam: string;
  kind: "PAYMENT" | "SHIPPING";
  methods: TransactionMethodConfig[];
  rows: {
    key: string;
    label: string;
    transactions: number;
    revenue: Prisma.Decimal;
  }[];
  money: (value: Prisma.Decimal) => string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          {title}
        </h2>
        {/* Figma: gradient "Add Method" pill, তারপর সময়ের pill। */}
        <div className="flex flex-wrap items-center gap-2 min-[480px]:gap-3">
          <MethodManagerModal
            kind={kind}
            label={kind === "PAYMENT" ? "Payment" : "Shipping"}
            methods={methods}
          />
          <SummaryRangeMenu value={range} param={rangeParam} />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
          No settled payments in this period yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            /**
             * ⚠️ Revenue-টা `ml-auto` দিয়ে ডান কিনারায় ঠেলে দেওয়া হয়,
             * তিন-কলামের grid নয়।
             *
             * grid-এ তৃতীয় কলামটা সারির এক-তৃতীয়াংশ জায়গায় বসত, তাই
             * চওড়া পর্দায় অঙ্কটা মাঝামাঝি ঝুলে থাকত — Figma-তে ওটা
             * কার্ডের একদম ডান কিনারায়। প্রথম দুটো ঘর বাঁয়ে জোড়া
             * থাকে, আর বাকি সব ফাঁকা জায়গা তাদের মাঝখানে পড়ে।
             */
            <div
              key={row.key}
              className="flex min-h-[80px] flex-wrap items-center gap-x-6 gap-y-3 rounded-[16px] bg-[#F9F6F3] p-4"
            >
              <Field label={rowLabel}>
                <span className={VALUE}>{row.label}</span>
              </Field>
              <Field label="Transactions">
                <span className={VALUE}>{row.transactions}</span>
              </Field>
              <div className="ml-auto flex min-w-0 flex-col items-end gap-3 text-right">
                <span className="truncate font-sora text-[14px] leading-none text-black/70 md:text-[16px]">
                  Revenue
                </span>
                <span className={VALUE}>{money(row.revenue)}</span>
              </div>
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
      /* ⚠️ `min-[640px]:self-start` ছাড়া ব্যাজটা কলামের পুরো চওড়া
         নিত: flex-col ঘরের ডিফল্ট `items-stretch` inline-flex-কেও
         টেনে বড় করে, আর `w-auto` তখন কিছুই করে না। */
      className={`inline-flex h-[44px] w-full items-center justify-center rounded-full px-4 font-sora text-[13px] font-semibold leading-none min-[640px]:h-[34px] min-[640px]:w-auto min-[640px]:self-start ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/**
 * লেবেল + মান।
 *
 * Figma "Frame 2147236266": লেবেল 16px Sora black/70, মান 20px Frank
 * Ruhl medium কালো, মাঝে 12px ফাঁক।
 *
 * ⚠️ ছোট পর্দায় মাপ কমে (14/16px), কারণ Figma-র সারিটা 999px চওড়া আর
 * তাতে ছ-টা ঘর পাশাপাশি ধরে। ফোনে ওই মাপ চাপালে প্রতিটা মান কেটে
 * "..." হয়ে যেত — সংখ্যাটা পড়তে না পারার চেয়ে একটু ছোট হরফ ভালো।
 */
function Field({
  label,
  size = "lg",
  className = "",
  children,
}: {
  label: string;
  /**
   * ⚠️ দুটো টেবিলে দুটো মাপ, আর সেটা Figma-রই।
   *
   *   "lg" — সারাংশের সারি (Frame 2147236324): লেবেল 16px, মান 20px।
   *          সারিতে মাত্র তিনটে ঘর, তাই জায়গা আছে।
   *   "sm" — Recent Transactions (Frame 2147236325): লেবেল 14px, মান
   *          16px। ওখানে আটটা ঘর পাশাপাশি, তাই হরফ ছোট না হলে
   *          কলামগুলো একে অন্যের ঘাড়ে উঠত।
   */
  size?: "lg" | "sm";
  /** grid-এ ঘরটার নিজস্ব আচরণ (কলাম জোড়া লাগানো, নিচে বসানো)। */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${className}`}>
      <span
        className={`truncate font-sora leading-none text-black/70 ${
          size === "lg" ? "text-[14px] md:text-[16px]" : "text-[13px] md:text-[14px]"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** সারাংশের মান — Frank Ruhl medium, 20px পর্যন্ত। */
const VALUE = "truncate font-frank-ruhl font-medium leading-none text-black text-[16px] md:text-[18px] xl:text-[20px]";

/** Recent Transactions-এর মান — Frank Ruhl medium, 16px। */
const VALUE_SM = "truncate font-frank-ruhl font-medium leading-none text-black text-[15px] md:text-[16px]";
