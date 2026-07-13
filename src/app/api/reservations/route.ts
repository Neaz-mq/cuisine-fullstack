import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTableAvailable } from "@/lib/reservations";
import { requireApiScope } from "@/lib/require-admin";

/**
 * src/app/api/reservations/route.ts
 *
 * GET  /api/reservations   -> all reservations, for the admin dashboard
 *                              (staff with the "reservations" scope)
 * POST /api/reservations   -> create a new reservation (public — works without
 *                              login too, matching the /table page which isn't
 *                              behind auth)
 */
export async function GET() {
  try {
    const authResult = await requireApiScope("reservations");
    if (authResult instanceof NextResponse) return authResult;

    const reservations = await prisma.reservation.findMany({
      orderBy: { reservedAt: "asc" },
      include: { table: true },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation list" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tableId, customerName, phone, guestCount, reservedAt } = body;

    // ---- Basic validation (matches the convention in the register route) ----
    if (!tableId || !customerName || !phone || !guestCount || !reservedAt) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

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
            guestCount: Number(guestCount),
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
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}