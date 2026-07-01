import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTableAvailable } from "@/lib/reservations";

/**
 * src/app/api/reservations/route.ts
 *
 * GET  /api/reservations   -> সব reservation, admin dashboard-এর জন্য (শুধু ADMIN)
 * POST /api/reservations   -> নতুন reservation তৈরি (public — login ছাড়াও করা যায়,
 *                              matches করে /table page যেটা এখন auth-protected না)
 */
export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const reservations = await prisma.reservation.findMany({
      orderBy: { reservedAt: "asc" },
      include: { table: true },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json(
      { error: "Reservation list আনতে সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tableId, customerName, phone, guestCount, reservedAt } = body;

    // ---- Basic validation (register route-এর সাথে convention মিলিয়ে) ----
    if (!tableId || !customerName || !phone || !guestCount || !reservedAt) {
      return NextResponse.json(
        { error: "সব ফিল্ড পূরণ করা আবশ্যক" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(reservedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "reservedAt একটা valid date/time হতে হবে" },
        { status: 400 }
      );
    }

    if (parsedDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "অতীতের সময়ে reservation করা যাবে না" },
        { status: 400 }
      );
    }

    const table = await prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });

    if (!table || !table.isActive) {
      return NextResponse.json(
        { error: "টেবিলটি পাওয়া যায়নি বা বর্তমানে অকার্যকর" },
        { status: 404 }
      );
    }

    if (guestCount > table.capacity) {
      return NextResponse.json(
        {
          error: `এই টেবিলে সর্বোচ্চ ${table.capacity} জন বসতে পারবে`,
        },
        { status: 400 }
      );
    }

    // ---- Race-condition-safe double-booking check ----
    // দুইজন একই মুহূর্তে একই স্লট বুক করার চেষ্টা করলে, availability চেক করার
    // পরও একটা ছোট window থাকে যেখানে দুটোই pass করে যেতে পারে। তাই টেবিল
    // অ্যাসাইনমেন্টের সাথে সাথেই একটা transaction-এর ভেতরে আবার চেক করা হচ্ছে,
    // যাতে conflict থাকলে দ্বিতীয় request টা reject হয়।
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
        { error: "এই সময়ে টেবিলটি ইতিমধ্যে বুক করা আছে, অন্য সময় বেছে নিন" },
        { status: 409 }
      );
    }

    // Serializable isolation-এ দুইটা concurrent request একই টেবিলের জন্য
    // fight করলে Prisma P2034 (transaction conflict) ছোঁড়ে — সেটাও
    // ইউজারের কাছে একই "conflict, আবার চেষ্টা করুন" বার্তা হিসেবে যাওয়া উচিত।
    const isSerializationConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2034";

    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "এই মুহূর্তে অনেকে বুক করার চেষ্টা করছে, আবার চেষ্টা করুন" },
        { status: 409 }
      );
    }

    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Reservation তৈরি করতে সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}