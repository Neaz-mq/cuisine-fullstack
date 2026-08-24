import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { periodStart, type DashboardPeriod, isDashboardPeriod } from "@/lib/dashboard-period";

/**
 * GET /api/admin/insights/export?period=&q=
 *
 * Dashboard-এর "Export Report" button-এর পেছনের route। পর্দায় যে
 * Recent Orders তালিকাটা দেখা যাচ্ছে, ঠিক সেটাই CSV হয়ে নামে — একই
 * period, একই search — শুধু page-এর ১০টা নয়, পুরোটা।
 *
 * ⚠️ scope "insights", "orders" নয়। এই ফাইল একবারে পুরো order book
 * (প্রতিটা গ্রাহকের নাম, email, খরচ) একটা ফাইলে ঢেলে দেয়। একজন WAITER-এর
 * আজকের order দেখা দরকার, কিন্তু সব গ্রাহকের তালিকা নামিয়ে নেওয়ার
 * ক্ষমতা নয় — dashboard নিজেও ঠিক এই scope দিয়েই পাহারা দেওয়া।
 */

/**
 * CSV-তে একটা ঘর নিরাপদে বসানো।
 *
 * দুটো আলাদা সমস্যা একসাথে সামলায়:
 *
 * ১। সাধারণ CSV escaping — কমা, উদ্ধৃতি বা newline থাকলে পুরোটা
 *    উদ্ধৃতিতে মুড়ে ভেতরের " কে "" করা।
 *
 * ২। CSV injection। Excel/Sheets `=`, `+`, `-`, `@` (এবং tab/CR) দিয়ে
 *    শুরু হওয়া ঘরকে সূত্র ধরে চালায়। কোনো গ্রাহক নিজের নাম
 *    `=HYPERLINK(...)` দিয়ে রাখলে সেটা মালিকের Excel-এ গিয়ে চলত।
 *    সামনে একটা `'` বসালে Excel ওটাকে লেখা হিসেবেই দেখে।
 */
function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const authResult = await requireApiScope("insights");
  if (authResult instanceof NextResponse) return authResult;

  // এই query-টা সস্তা নয় (পুরো তালিকা, কোনো page limit ছাড়া), আর
  // button-এ বারবার click করলে প্রতিবারই নতুন করে চলে। ঘণ্টায় ৩০টা
  // export একজন মালিকের জন্য যথেষ্টের বেশি।
  const rate = checkRateLimit(request, "insights-export", {
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
  const rawPeriod = searchParams.get("period");
  // অচেনা period চুপচাপ "all" হয়ে যায় — URL হাতে বদলে দিলে error নয়,
  // শুধু ছাঁকনিটা খুলে যায়।
  const period: DashboardPeriod = isDashboardPeriod(rawPeriod) ? rawPeriod : "all";
  const q = searchParams.get("q")?.trim();

  const since = periodStart(period);

  const orders = await prisma.order.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { user: { name: { contains: q, mode: "insensitive" as const } } },
              { user: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const header = [
    "Order ID",
    "Customer Name",
    "Customer Email",
    "Date",
    "Time",
    "Status",
    "Currency",
    "Amount",
  ];

  const rows = orders.map((order) => {
    const name = order.user?.name ?? `${order.firstName} ${order.lastName}`.trim();
    return [
      `#ORD-${order.id.slice(-6).toUpperCase()}`,
      name,
      order.user?.email ?? order.email ?? "",
      order.createdAt.toISOString().slice(0, 10),
      order.createdAt.toISOString().slice(11, 16),
      order.status,
      order.currency,
      // প্রতিটা order-এর নিজের snapshot করা দশমিক — তালিকায় ভিন্ন
      // মুদ্রার order মিশে থাকতে পারে, তাই আজকের setting নয়।
      order.totalAmount.toFixed(order.currencyMinorUnits),
    ];
  });

  // \uFEFF (BOM) — এটা ছাড়া Excel UTF-8 ধরে না, আর বাংলা নাম বা ৳
  // চিহ্ন খোলার পর দুর্বোধ্য অক্ষরে ভরে যায়। \r\n কারণ CSV-র
  // নির্দিষ্টকরণে (RFC 4180) সেটাই line break.
  const csv =
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-orders-${period}-${stamp}.csv"`,
      // এটা ব্যক্তিগত তথ্য — কোনো proxy বা CDN যেন ধরে না রাখে।
      "Cache-Control": "no-store",
    },
  });
}