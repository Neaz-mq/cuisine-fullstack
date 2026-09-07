import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { DEFAULT_ORDER_STATUS, isOrderStatus } from "@/lib/order-status-filter";

/**
 * GET /api/admin/orders/export?q=&status=
 *
 * /admin/orders-এর "Export Report" — পর্দায় যা দেখা যাচ্ছে ঠিক সেটাই
 * নামে (একই search, একই status ছাঁকনি)।
 *
 * ⚠️ ছাঁকার যুক্তিটা admin/orders/page.tsx-এর হুবহু নকল, ইচ্ছাকৃতভাবে —
 * kitchen, inventory, categories আর menu-র export route-এও একই কথা
 * লেখা আছে, একই কারণে: দুটো আলাদা হলে পর্দায় এক তালিকা আর ফাইলে
 * আরেকটা, আর সেই গরমিলটা কেউ ধরতে পারে না।
 *
 * ⚠️ `page` নেওয়া হয় না — export মানে পুরো ছাঁকা তালিকা, পর্দায় দেখা
 * দশটা সারি নয়। `period`-ও নয়: ওটা কেবল Overview-র সংখ্যা বদলায়।
 *
 * ⚠️ কিন্তু একটা ছাদ আছে: বেশি হলে ৫০০০ সারি। এটা রেস্তোরাঁর ইতিহাস,
 * অর্থাৎ সংখ্যাটা বছরের পর বছর বাড়ে — ছাদ ছাড়া একটা export একদিন পুরো
 * টেবিলটা memory-তে তুলে সার্ভার ফেলে দিত।
 */
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  const authResult = await requireApiScope("orders");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "orders-export", {
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
  const status = isOrderStatus(rawStatus) ? rawStatus : DEFAULT_ORDER_STATUS;

  const where: Prisma.OrderWhereInput = {
    ...(status !== "ALL"
      ? { status: status as Prisma.OrderWhereInput["status"] }
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
      status: true,
      orderType: true,
      shippingMethod: true,
      paymentMethod: true,
      paymentStatus: true,
      totalAmount: true,
      currency: true,
      currencyMinorUnits: true,
      firstName: true,
      lastName: true,
      email: true,
      userId: true,
      user: { select: { name: true } },
      table: { select: { label: true } },
      items: {
        select: {
          quantity: true,
          menuItem: { select: { title: true } },
        },
      },
    },
  });

  const header = [
    "Order ID",
    "Placed",
    "Customer",
    "Guest",
    "Email",
    "Order Type",
    "Channel",
    "Status",
    "Payment Method",
    "Payment Status",
    "Items",
    "Item Count",
    "Total",
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
      // ⚠️ "Guest" আলাদা কলাম, নামের সাথে জোড়া নয় — spreadsheet-এ
      // ছাঁকতে গেলে "(Guest)" লেখাটা নামের ভেতরে থাকলে কাজেই আসত না।
      order.userId ? "No" : "Yes",
      order.email ?? "",
      order.orderType,
      channel,
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      // বিভাজক সেমিকোলন, কমা নয় — কমা হলে csvCell পুরো ঘরটা উদ্ধৃতিতে
      // মুড়ত (Excel ঠিকই পড়ত), কিন্তু চোখে দেখে কলামের কমা আর ভেতরের
      // কমা আলাদা করা যেত না। kitchen-এর export-এ একই সিদ্ধান্ত।
      order.items.map((item) => `${item.menuItem.title} x${item.quantity}`).join("; "),
      String(order.items.reduce((sum, item) => sum + item.quantity, 0)),
      // কাঁচা সংখ্যা, মুদ্রা-চিহ্ন ছাড়া — "$26.76" লিখলে Excel ওটাকে
      // লেখা ধরত আর যোগ বা sort কিছুই করা যেত না। মুদ্রাটা পরের কলামে।
      order.totalAmount.toFixed(order.currencyMinorUnits),
      order.currency,
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-orders-${status.toLowerCase()}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
