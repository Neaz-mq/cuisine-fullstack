import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { DEFAULT_PAYMENT_STATUS, isPaymentStatus } from "@/lib/payment-filters";

/**
 * GET /api/admin/payments/export — /admin/payment পাতার "Export Report"।
 *
 * ⚠️ Orders-এর export-টা পুনর্ব্যবহার করা যেত না, যদিও সারিগুলো একই
 * টেবিলের: ওটা `status` (অর্ডারের অগ্রগতি) দিয়ে ছাঁকে, আর এই পাতা
 * ছাঁকে `paymentStatus` (টাকার অবস্থা) দিয়ে। একই endpoint ব্যবহার
 * করলে পর্দায় "Refunded" ছেঁকে রেখে export করলে ফাইলে অন্য সারি আসত —
 * আর সেটা ধরা পড়ত অনেক পরে, হিসাব মেলানোর সময়।
 *
 * ⚠️ scope "refunds", "orders" নয় — এই পাতার layout-ও তাই চায়। টাকা
 * ফেরত দেওয়া আর অর্ডার এগিয়ে নেওয়া এই অ্যাপে আলাদা অধিকার।
 */
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  const authResult = await requireApiScope("refunds");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "payments-export", {
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
  const q = searchParams.get("q")?.trim();
  const rawStatus = searchParams.get("status");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  const status = isPaymentStatus(rawStatus) ? rawStatus : DEFAULT_PAYMENT_STATUS;

  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL"
      ? { paymentStatus: status as Prisma.OrderWhereInput["paymentStatus"] }
      : {}),
    ...(orderSearchFilter(q) ?? {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      createdAt: true,
      orderType: true,
      shippingMethod: true,
      paymentMethod: true,
      paymentStatus: true,
      grandTotal: true,
      refundedAmount: true,
      currency: true,
      currencyMinorUnits: true,
      firstName: true,
      lastName: true,
      email: true,
      userId: true,
      user: { select: { name: true } },
      table: { select: { label: true } },
    },
  });

  const header = [
    "Order ID",
    "Placed",
    "Customer",
    "Guest",
    "Email",
    "Channel",
    "Payment Method",
    "Payment Status",
    "Gross",
    "Refunded",
    "Net",
    "Currency",
  ];

  const rows = orders.map((order) => {
    const channel =
      order.orderType === "DINE_IN"
        ? `Table ${order.table?.label ?? "—"}`
        : (order.shippingMethod ?? "Online");

    return [
      formatOrderId(order.id),
      order.createdAt.toISOString(),
      order.user?.name ?? `${order.firstName} ${order.lastName}`.trim(),
      // "Guest" আলাদা কলাম, নামের সাথে জোড়া নয় — spreadsheet-এ ছাঁকতে
      // গেলে "(Guest)" লেখাটা নামের ভেতরে থাকলে কাজেই আসত না।
      order.userId ? "No" : "Yes",
      order.email ?? "",
      channel,
      order.paymentMethod,
      order.paymentStatus,
      /**
       * ⚠️ তিনটে আলাদা কলাম: মোট, ফেরত, আর নিট।
       *
       * পাতার Overview-তে কেবল নিট সংখ্যাটাই দেখানো হয়, কিন্তু হিসাব
       * মেলানোর সময় "কত এসেছিল আর কত ফেরত গেছে" দুটোই লাগে — শুধু নিট
       * দিলে সেটা spreadsheet-এ আর ভাঙা যেত না।
       *
       * কাঁচা সংখ্যা, মুদ্রা-চিহ্ন ছাড়া — "$26.76" লিখলে Excel ওটাকে
       * লেখা ধরত আর যোগ বা sort কিছুই করা যেত না।
       */
      order.grandTotal.toFixed(order.currencyMinorUnits),
      order.refundedAmount.toFixed(order.currencyMinorUnits),
      order.grandTotal.minus(order.refundedAmount).toFixed(order.currencyMinorUnits),
      order.currency,
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-payments-${status.toLowerCase()}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
