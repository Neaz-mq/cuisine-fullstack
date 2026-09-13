import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { DEFAULT_OVERVIEW_RANGE, isSummaryRange, summaryRangeStart } from "@/lib/payment-filters";
import {
  DEFAULT_RESERVATION_STATUS,
  isReservationStatus,
} from "@/lib/reservation-filters";

/**
 * GET /api/admin/reservations/export — পাতার "Export Report"।
 *
 * ⚠️ ছাঁকনিগুলো পাতার সাথে হুবহু এক (`q`, `status`, `list`) — নাহলে
 * পর্দায় এক জিনিস দেখে ফাইলে আরেক জিনিস পাওয়া যেত, আর সেটা ধরা পড়ত
 * অনেক পরে।
 */
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  const authResult = await requireApiScope("reservations");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "reservations-export", {
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
  // অচেনা মান চুপচাপ ডিফল্টে ফেরে — URL হাতে বদলে দিলে error নয়।
  const rawStatus = searchParams.get("status");
  const status = isReservationStatus(rawStatus) ? rawStatus : DEFAULT_RESERVATION_STATUS;
  const rawRange = searchParams.get("list");
  const range = isSummaryRange(rawRange) ? rawRange : DEFAULT_OVERVIEW_RANGE;
  const start = summaryRangeStart(range);

  const where: Prisma.ReservationWhereInput = {
    ...(status !== "ALL"
      ? { status: status as Prisma.ReservationWhereInput["status"] }
      : {}),
    ...(start ? { reservedAt: { gte: start } } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: { reservedAt: "asc" },
    take: MAX_ROWS,
    select: {
      customerName: true,
      phone: true,
      email: true,
      guestCount: true,
      reservedAt: true,
      status: true,
      specialRequests: true,
      depositAmount: true,
      depositPaidAt: true,
      createdAt: true,
      table: { select: { label: true } },
    },
  });

  const header = [
    "Customer",
    "Phone",
    "Email",
    "Table",
    "Guests",
    "Reserved For",
    "Status",
    "Deposit",
    "Deposit Paid",
    "Booked On",
    "Special Requests",
  ];

  const rows = reservations.map((reservation) => [
    reservation.customerName,
    reservation.phone,
    reservation.email ?? "",
    reservation.table.label,
    String(reservation.guestCount),
    // ISO — spreadsheet-এ sort আর ছাঁকা দুটোই এতে ঠিকঠাক কাজ করে।
    reservation.reservedAt.toISOString(),
    reservation.status,
    // কাঁচা সংখ্যা, মুদ্রা-চিহ্ন ছাড়া; না থাকলে ফাঁকা, "0" নয় —
    // "কোনো deposit লাগেনি" আর "deposit শূন্য" এক কথা নয়।
    reservation.depositAmount ? reservation.depositAmount.toString() : "",
    reservation.depositPaidAt ? reservation.depositPaidAt.toISOString() : "",
    reservation.createdAt.toISOString(),
    reservation.specialRequests ?? "",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-reservations-${status.toLowerCase()}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
