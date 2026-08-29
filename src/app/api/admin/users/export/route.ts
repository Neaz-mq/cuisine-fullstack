import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { Prisma } from "@/generated/prisma/client";
import {
  CATEGORY_LABELS,
  categoryFor,
  isCustomerCategory,
  pointsRangeFor,
} from "@/lib/customer-category";

/**
 * GET /api/admin/users/export?q=&category=
 *
 * /admin/users-এর "Export Report" বোতামের পেছনের route। পর্দায় যে
 * তালিকাটা দেখা যাচ্ছে ঠিক সেটাই CSV হয়ে নামে — একই search, একই
 * শ্রেণি-ছাঁকনি — শুধু page-এর ১০টা নয়, পুরোটা।
 *
 * ⚠️ scope "staff", "insights" নয়।
 *
 * Dashboard-এর export order-এর হিসাব দেয়; এটা দেয় মানুষের তালিকা —
 * নাম, ইমেইল, ফোন নম্বর, কতদিনের গ্রাহক। ওটা ব্যবসার তথ্য, এটা
 * ব্যক্তিগত তথ্য, আর দুটোর অধিকার এক নয়। /admin/users পাতাটা নিজেও
 * ঠিক এই scope দিয়েই পাহারা দেওয়া (users/layout.tsx), তাই যিনি পাতাটা
 * দেখতে পান কেবল তিনিই নামাতে পারেন — কম নয়, বেশিও নয়।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("staff");
  if (authResult instanceof NextResponse) return authResult;

  // পুরো গ্রাহক-তালিকা, কোনো page limit ছাড়া — সস্তা query নয়, আর
  // এটা একবারে সব ব্যক্তিগত তথ্য এক ফাইলে ঢালে। insights export-এর
  // মতোই ঘণ্টায় ৩০টা।
  const rate = checkRateLimit(request, "users-export", {
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
  const rawCategory = searchParams.get("category");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়,
  // শুধু ছাঁকনিটা খুলে যায়। insights export-এও একই আচরণ।
  const category = isCustomerCategory(rawCategory) ? rawCategory : null;

  /**
   * ⚠️ এই শর্তটা page.tsx-এর শর্তের হুবহু প্রতিরূপ হতে হবে — নাহলে
   * পর্দায় এক তালিকা আর ফাইলে আরেক, আর সেটা ধরা পড়ে অনেক পরে।
   * page.tsx-এ বদলালে এখানেও বদলাতে হবে।
   */
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(category === "new"
      ? { orders: { none: {} } }
      : category
        ? {
            orders: { some: {} },
            loyaltyPoints: (() => {
              const { min, max } = pointsRangeFor(category);
              return max === null ? { gte: min } : { gte: min, lt: max };
            })(),
          }
        : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      loyaltyPoints: true,
      _count: { select: { orders: true } },
    },
  });

  const header = [
    "Name",
    "Email",
    "Phone",
    "Member Since",
    "Customer Category",
    "Reward Points",
    "Total Orders",
  ];

  const rows = users.map((user) => [
    user.name ?? "",
    user.email,
    // ⚠️ ফাঁকা রাখা হয়, "—" নয়। ওটা পর্দার জন্য; spreadsheet-এ একটা
    // dash মানে "এই ঘরে dash লেখা আছে", আর তখন ফোন-নম্বরের কলাম ধরে
    // ছাঁকা বা মিলিয়ে দেখা যায় না।
    user.phone ?? "",
    // ISO তারিখ, "Jul 3, 2026" নয় — spreadsheet এটাকে তারিখ হিসেবে
    // চেনে আর সাজাতে পারে, আর locale বদলালেও অর্থ বদলায় না।
    user.createdAt.toISOString().slice(0, 10),
    CATEGORY_LABELS[categoryFor(user.loyaltyPoints, user._count.orders)],
    user.loyaltyPoints,
    user._count.orders,
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = category ?? "all";

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-customers-${suffix}-${stamp}.csv"`,
      // এটা ব্যক্তিগত তথ্য — কোনো proxy বা CDN যেন ধরে না রাখে।
      "Cache-Control": "no-store",
    },
  });
}