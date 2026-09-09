import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/admin/tables/export?q=
 *
 * /admin/tables-এর "Export Report" — পর্দায় তালিকায় যা দেখা যাচ্ছে ঠিক
 * সেটাই নামে (একই search)।
 *
 * ⚠️ ছাঁকার যুক্তিটা admin/tables/page.tsx-এর হুবহু নকল, ইচ্ছাকৃতভাবে —
 * categories, kitchen আর inventory-র export route-এও ঠিক এই কথাটা লেখা
 * আছে, একই কারণে: দুটো আলাদা হলে পর্দায় এক তালিকা আর ফাইলে আরেকটা, আর
 * সেই গরমিলটা কেউ ধরতে পারে না।
 *
 * ⚠️ `page` নেওয়া হয় না — export মানে পুরো ছাঁকা তালিকা, পর্দায় দেখা
 * পনেরোটা কার্ড নয়।
 *
 * ⚠️ কার্ডের Active/Inactive ছাঁকনিটাও নেওয়া হয় না, আর সেটাও ইচ্ছাকৃত:
 * ওটা client-এ চলে (URL-এ যায় না), আর Status এখানে নিজেই একটা কলাম —
 * spreadsheet-এ ওটা দিয়ে যা খুশি ছাঁকা যায়।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("tables");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "tables-export", {
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
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const now = new Date();

  const rows = await prisma.restaurantTable.findMany({
    select: {
      label: true,
      name: true,
      capacity: true,
      isActive: true,
      createdAt: true,
      _count: { select: { reservations: true } },
      // আসন্নগুলো আলাদা করে — নিচে "Upcoming" কলামের জন্য। পাতার
      // query-তে `take: 2`, কিন্তু এখানে সংখ্যাটা পুরো লাগে।
      reservations: {
        where: { reservedAt: { gte: now }, status: { not: "CANCELLED" } },
        orderBy: { reservedAt: "asc" },
        select: { reservedAt: true },
      },
    },
  });

  // page.tsx-এর হুবহু একই natural sort — "T-10" যেন "T-2"-এর আগে না বসে।
  const sorted = [...rows].sort((a, b) => {
    const numA = parseInt(a.label.replace(/\D/g, ""), 10);
    const numB = parseInt(b.label.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    return a.label.localeCompare(b.label);
  });

  const visible = sorted.filter((row) => {
    if (!q) return true;
    return (
      row.label.toLowerCase().includes(q) || (row.name ?? "").toLowerCase().includes(q)
    );
  });

  const header = [
    "Table",
    "Name",
    "Seats",
    "Status",
    "Upcoming Reservations",
    "Next Reservation",
    "Total Reservations",
    "Added",
  ];

  const rowsOut = visible.map((row) => [
    row.label,
    row.name ?? "",
    // কাঁচা সংখ্যা — spreadsheet-এ সাজানো বা যোগ করা যায়।
    String(row.capacity),
    row.isActive ? "Active" : "Inactive",
    String(row.reservations.length),
    /**
     * ⚠️ ISO, স্থানীয় বিন্যাস নয়।
     *
     * পর্দায় "21 Jul, 09:30" দেখানো হয় কারণ ওটা পড়ার জিনিস। একটা
     * CSV খোলা হয় spreadsheet-এ, আর সেখানে "21 Jul" দিয়ে sort করলে
     * বর্ণানুক্রমে সাজে — অগাস্টের আগে এপ্রিল। ISO-তে সেটা হয় না।
     */
    row.reservations[0]?.reservedAt.toISOString() ?? "",
    String(row._count.reservations),
    row.createdAt.toISOString().slice(0, 10),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-tables-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
