import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { periodStart, type DashboardPeriod, isDashboardPeriod } from "@/lib/dashboard-period";
import { toCsv } from "@/lib/csv";

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

  // ⚠️ csvCell আর BOM-এর হিসাবটা এখন lib/csv.ts-এ — /admin/users-এর
  // export route-ও ঠিক একই escaping চায়, আর CSV injection ঠেকানোর
  // কোডের দুটো কপি রাখা মানে একদিন একটা সারানো হবে, অন্যটা নয়।
  const csv = toCsv(header, rows);

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