import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isTableAvailable } from "@/lib/reservations";

/**
 * src/app/api/tables/route.ts
 *
 * GET  /api/tables                          -> সব active table, availability ছাড়া
 * GET  /api/tables?reservedAt=<ISO string>   -> সেই নির্দিষ্ট সময়ে কোন টেবিল খালি তা সহ
 * POST /api/tables                          -> নতুন table তৈরি (শুধু ADMIN)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reservedAtParam = searchParams.get("reservedAt");

    const tables = await prisma.restaurantTable.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
    });

    if (!reservedAtParam) {
      return NextResponse.json(
        tables.map((t) => ({ ...t, available: null }))
      );
    }

    const reservedAt = new Date(reservedAtParam);
    if (Number.isNaN(reservedAt.getTime())) {
      return NextResponse.json(
        { error: "reservedAt একটা valid date/time হতে হবে" },
        { status: 400 }
      );
    }

    const withAvailability = await Promise.all(
      tables.map(async (table) => ({
        ...table,
        available: await isTableAvailable(table.id, reservedAt),
      }))
    );

    return NextResponse.json(withAvailability);
  } catch (error) {
    console.error("GET /api/tables error:", error);
    return NextResponse.json(
      { error: "Table list আনতে সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { label, capacity } = body;

    if (!label || typeof label !== "string") {
      return NextResponse.json(
        { error: "Table label প্রয়োজন" },
        { status: 400 }
      );
    }

    const table = await prisma.restaurantTable.create({
      data: {
        label,
        capacity: typeof capacity === "number" && capacity > 0 ? capacity : 4,
      },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error: unknown) {
    const isUniqueConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUniqueConflict) {
      return NextResponse.json(
        { error: "এই label-এর টেবিল আগে থেকেই আছে" },
        { status: 409 }
      );
    }

    console.error("POST /api/tables error:", error);
    return NextResponse.json(
      { error: "Table তৈরি করতে সমস্যা হয়েছে" },
      { status: 500 }
    );
  }
}