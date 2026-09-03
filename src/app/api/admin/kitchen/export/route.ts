import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { minutesAgo } from "@/lib/time";
import { formatOrderId, orderIdSearchToken } from "@/lib/format-order-id";
import {
  DEFAULT_KITCHEN_STATUS,
  KITCHEN_STATUS_TO_ORDER_STATUS,
  isKitchenStatus,
} from "@/lib/kitchen-status";

const READY_COLUMN_WINDOW_MINUTES = 15;

const STATUS_LABELS: Record<string, string> = {
  PLACED: "Placed",
  PREPARING: "Preparing",
  OUT_FOR_DELIVERY: "Ready",
};

/**
 * GET /api/admin/kitchen/export?q=&status=
 *
 * /admin/kitchen-এর "Export Report" — পর্দায় বোর্ডে যা দেখা যাচ্ছে ঠিক
 * সেটাই নামে (একই search, একই status-ছাঁকনি)।
 *
 * ⚠️ ছাঁকার যুক্তিটা admin/kitchen/page.tsx-এর হুবহু নকল, ইচ্ছাকৃতভাবে।
 * দুটো আলাদা হলে পর্দায় এক তালিকা আর ফাইলে আরেকটা — inventory-র
 * export route-এও ঠিক এই কথাটা লেখা আছে, একই কারণে।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("kitchen");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "kitchen-export", {
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
  const q = searchParams.get("q")?.trim() ?? "";
  const rawStatus = searchParams.get("status");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  //
  // ⚠️ তালিকাটা এখানে আবার লেখা হয়নি, `lib/kitchen-status.ts` থেকে —
  // দুই জায়গায় দুটো কপি থাকলে একদিন একটায় নতুন ছাঁকনি যোগ হতো আর
  // export নীরবে পুরনো নিয়মে চলত।
  const status = isKitchenStatus(rawStatus) ? rawStatus : DEFAULT_KITCHEN_STATUS;

  const readySince = minutesAgo(READY_COLUMN_WINDOW_MINUTES);

  const rows = await prisma.order.findMany({
    where: {
      OR: [
        { status: { in: ["PLACED", "PREPARING"] } },
        { status: "OUT_FOR_DELIVERY", updatedAt: { gte: readySince } },
      ],
    },
    include: {
      items: { include: { menuItem: { select: { title: true } } } },
      table: { select: { label: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const token = orderIdSearchToken(q);
  const visible = rows.filter((row) => {
    // ⚠️ তিনটে আলাদা `if` নয়, একটাই মানচিত্র — নতুন কোনো কলাম যোগ
    // হলে `lib/kitchen-status.ts`-এ একবার লিখলেই পাতা আর export
    // দুটোই সেটা মানে।
    if (status !== "all" && row.status !== KITCHEN_STATUS_TO_ORDER_STATUS[status]) return false;

    if (!q) return true;
    if (token) return row.id.toLowerCase().endsWith(token.toLowerCase());
    return `${row.firstName} ${row.lastName}`.toLowerCase().includes(q.toLowerCase());
  });

  const header = [
    "Order ID",
    "Customer",
    "Order Type",
    "Table",
    "Status",
    "Placed At",
    "Minutes Waiting",
    "Items",
  ];

  const nowMs = Date.now();

  const rowsOut = visible.map((row) => [
    formatOrderId(row.id),
    `${row.firstName} ${row.lastName}`.trim(),
    row.orderType === "DINE_IN" ? "Dine in" : "Delivery",
    // ⚠️ ফাঁকা, "—" নয় — ওটা পর্দার জন্য। spreadsheet-এ একটা dash মানে
    // "এই ঘরে dash লেখা আছে", আর তখন কলাম ধরে ছাঁকা যায় না।
    row.table?.label ?? "",
    STATUS_LABELS[row.status] ?? row.status,
    row.createdAt.toISOString(),
    // কাঁচা সংখ্যা, "14m ago" নয় — spreadsheet-এ সাজানো যায়।
    String(Math.floor((nowMs - row.createdAt.getTime()) / 60000)),
    // একটা ঘরে পুরো তালিকা, "2× Juicy Burger; 1× Cold Coffee" ছাঁদে।
    // ⚠️ বিভাজক হিসেবে সেমিকোলন, কমা নয় — কমা হলে csvCell পুরো ঘরটা
    // উদ্ধৃতিতে মুড়ত আর Excel-এ পড়তে অসুবিধা হতো না, কিন্তু চোখে
    // দেখে কলামের কমা আর ভেতরের কমা আলাদা করা যেত না।
    row.items.map((item) => `${item.quantity}× ${item.menuItem.title}`).join("; "),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-kitchen-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
