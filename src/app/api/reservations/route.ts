import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTableAvailable } from "@/lib/reservations";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validations/parse";
import { createReservationSchema } from "@/lib/validations/reservation";
import { paginationSchema } from "@/lib/validations/common";

/**
 * src/app/api/reservations/route.ts
 *
 * GET  /api/reservations   -> paginated reservation list, for the admin
 *                              dashboard (staff with the "reservations"
 *                              scope). Accepts ?page= and ?limit=.
 * POST /api/reservations   -> create a new reservation (public — works without
 *                              login too, matching the /table page which isn't
 *                              behind auth)
 */

/**
 * Paginated for the same reason GET /api/orders is: this used to return
 * every reservation ever made, including cancelled and completed ones,
 * each with its full table row. Reservations accumulate faster than
 * orders in a busy restaurant and are never pruned.
 *
 * Nothing calls this endpoint today — /admin/reservations/page.tsx is a
 * server component that queries Prisma directly and paginates there —
 * but the endpoint is live, and the first caller to appear would have
 * inherited an unbounded query.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireApiScope("reservations");
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const parsedPagination = paginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsedPagination.success) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
    }
    const { page, limit } = parsedPagination.data;

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        orderBy: { reservedAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { table: true },
      }),
      prisma.reservation.count(),
    ]);

    // ⚠️ Shape change: this used to be a bare array.
    return NextResponse.json({
      reservations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json({ error: "Failed to fetch reservation list" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Public, unauthenticated endpoint that reserves a physical resource.
    // Unlike a spam order — which staff can cancel — a flood of fake
    // bookings makes real tables show as unavailable to real customers,
    // so the damage lands on revenue before anyone notices, and someone
    // has to clear them out by hand afterwards.
    //
    // Lower than the order limit (5 vs 10) because a genuine customer
    // books once. Retrying a couple of times after picking an
    // already-taken slot is normal; five attempts in ten minutes is not.
    //
    // ⚠️ rate-limit.ts is process-local — see its own file comment. This
    // deters casual scripted abuse; it is not a hard distributed
    // guarantee.
    const rateLimitResult = checkRateLimit(request, "create-reservation", {
      limit: 5,
      windowMs: 10 * 60_000,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many reservation attempts. Please wait a moment and try again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
        }
      );
    }

    const parsed = await parseBody(request, createReservationSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { tableId, customerName, phone, guestCount, reservedAt } = parsed;

    const parsedDate = new Date(reservedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "reservedAt must be a valid date/time" },
        { status: 400 }
      );
    }

    if (parsedDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Cannot make a reservation in the past" },
        { status: 400 }
      );
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });

    if (!table || !table.isActive) {
      return NextResponse.json(
        { error: "Table not found or currently inactive" },
        { status: 404 }
      );
    }

    if (guestCount > table.capacity) {
      return NextResponse.json(
        { error: `This table can seat a maximum of ${table.capacity} guests` },
        { status: 400 }
      );
    }

    // ---- Race-condition-safe double-booking check ----
    // If two people try to book the same slot at nearly the same moment,
    // there's a small window where both could pass the availability check.
    // So right when we assign the table, we check again inside a
    // transaction, so a genuine conflict rejects the second request.
    //
    // Serializable is what actually makes this work, not the re-check on
    // its own. Under the default READ COMMITTED, both transactions would
    // still see "no overlapping rows" — neither can see the other's
    // uncommitted insert — and both would succeed. Postgres' SSI takes
    // predicate locks on the range that isTableAvailable scans, spots the
    // dependency cycle, and aborts one of them with a serialization
    // failure, which surfaces as P2034 and is handled below.
    const session = await auth();

    const reservation = await prisma.$transaction(
      async (tx) => {
        const stillAvailable = await isTableAvailable(tableId, parsedDate, {
          db: tx,
        });
        if (!stillAvailable) {
          throw new Error("TABLE_UNAVAILABLE");
        }

        return tx.reservation.create({
          data: {
            tableId,
            customerName,
            phone,
            guestCount,
            reservedAt: parsedDate,
            status: "CONFIRMED",
            userId: session?.user?.id ?? null,
          },
          include: { table: true },
        });
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TABLE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "This table is already booked at that time, please pick another slot" },
        { status: 409 }
      );
    }

    // Under Serializable isolation, two concurrent requests fighting over the
    // same table can make Prisma throw P2034 (transaction conflict) — that
    // should surface to the user as the same "conflict, try again" message.
    const isSerializationConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2034";

    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "Lots of people are booking right now, please try again" },
        { status: 409 }
      );
    }

    console.error("POST /api/reservations error:", error);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}