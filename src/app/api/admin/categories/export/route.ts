import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import {
  DEFAULT_CATEGORY_FILTER,
  isCategoryFilter,
  type CategoryFilter,
} from "@/lib/category-filter";

/**
 * GET /api/admin/categories/export?q=&filter=
 *
 * /admin/categories-এর "Export Report" — পর্দায় তালিকায় যা দেখা যাচ্ছে
 * ঠিক সেটাই নামে (একই search, একই All/Active/Empty ছাঁকনি)।
 *
 * ⚠️ ছাঁকার যুক্তিটা admin/categories/page.tsx-এর হুবহু নকল,
 * ইচ্ছাকৃতভাবে — kitchen আর inventory-র export route-এও ঠিক এই কথাটা
 * লেখা আছে, একই কারণে: দুটো আলাদা হলে পর্দায় এক তালিকা আর ফাইলে
 * আরেকটা, আর সেই গরমিলটা কেউ ধরতে পারে না।
 *
 * ⚠️ `page` নেওয়া হয় না — export মানে পুরো ছাঁকা তালিকা, পর্দায় দেখা
 * পাঁচটা সারি নয়। ExportReportButton-এর forwardParams-এও তাই `page`
 * নেই।
 *
 * ⚠️ Overview-র `scope` ছাঁকনিটাও নেওয়া হয় না, আর সেটাও ইচ্ছাকৃত:
 * ওটা তালিকার কিছুই বদলায় না, শুধু উপরের চারটে কার্ডের সংখ্যা।
 * তার বদলে প্রতিটা সারিতে Available/Unavailable আলাদা কলাম হিসেবেই
 * আছে — spreadsheet-এ ওটা দিয়ে যা খুশি ছাঁকা যায়।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("categories");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "categories-export", {
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
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  // তালিকাটা `lib/category-filter.ts` থেকে, এখানে আবার লেখা হয়নি।
  const rawFilter = searchParams.get("filter");
  const filter: CategoryFilter = isCategoryFilter(rawFilter)
    ? rawFilter
    : DEFAULT_CATEGORY_FILTER;

  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      menuItems: {
        orderBy: { title: "asc" },
        select: { title: true, isAvailable: true },
      },
    },
  });

  const visible = rows.filter((row) => {
    if (filter === "active" && !row.menuItems.some((item) => item.isAvailable)) return false;
    if (filter === "empty" && row.menuItems.length > 0) return false;
    if (!q) return true;
    return row.name.toLowerCase().includes(q.toLowerCase());
  });

  const header = [
    "Category",
    "Menu Items",
    "Available",
    "Unavailable",
    "Status",
    "Items",
  ];

  const rowsOut = visible.map((row) => {
    const available = row.menuItems.filter((item) => item.isAvailable).length;

    /**
     * তিনটে অবস্থা, আর মাঝেরটাই আসল কারণ এই কলামটা থাকার:
     * পদ আছে কিন্তু সবগুলো বন্ধ — খদ্দেরের কাছে শ্রেণিটা কার্যত খালি,
     * অথচ "Empty" ছাঁকনিতে সেটা ধরা পড়ে না (ওটা "একটাও পদ নেই" খোঁজে)।
     */
    const status =
      row.menuItems.length === 0 ? "Empty" : available > 0 ? "Active" : "Unavailable";

    return [
      row.name,
      // কাঁচা সংখ্যা — spreadsheet-এ সাজানো বা যোগ করা যায়।
      String(row.menuItems.length),
      String(available),
      String(row.menuItems.length - available),
      status,
      /**
       * একটা ঘরে পুরো তালিকা। বিভাজক সেমিকোলন, কমা নয় — কমা হলে
       * csvCell পুরো ঘরটা উদ্ধৃতিতে মুড়ত (Excel ঠিকই পড়ত), কিন্তু চোখে
       * দেখে কলামের কমা আর ভেতরের কমা আলাদা করা যেত না। kitchen-এর
       * export-এ একই সিদ্ধান্ত।
       */
      row.menuItems.map((item) => item.title).join("; "),
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-categories-${filter}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
