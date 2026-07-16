import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTableAvailable } from "@/lib/reservations";
import { requireApiScope } from "@/lib/require-admin";
import { publicCreateTableSchema, tablesAvailabilityQuerySchema } from "@/lib/validations/admin";
import { parseBody, parseQuery } from "@/lib/validations/parse";

/**
 * src/app/api/tables/route.ts
 *
 * GET  /api/tables                          -> all active tables, no availability
 * GET  /api/tables?reservedAt=<ISO string>   -> same, plus availability at that time
 * POST /api/tables                          -> create a new table (staff with
 *                                               the "tables" scope)
 */

/**
 * Postgres sorts "label" as plain text, so "T-10" comes right after "T-1"
 * (alphabetically "1" < "2"), producing T-1, T-10, T-2, T-3... instead of
 * T-1, T-2, ... T-10. We fetch and then sort "naturally" in JS: extract the
 * numeric part of the label and compare numerically, falling back to a plain
 * string compare for labels with no digits.
 */
function naturalSortByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const numA = a.label.match(/\d+/);
    const numB = b.label.match(/\d+/);

    if (numA && numB) {
      return Number(numA[0]) - Number(numB[0]);
    }
    return a.label.localeCompare(b.label);
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = parseQuery(searchParams, tablesAvailabilityQuerySchema);
    if (parsedQuery instanceof NextResponse) return parsedQuery;
    const { reservedAt: reservedAtParam } = parsedQuery;

    const tables = naturalSortByLabel(
      await prisma.restaurantTable.findMany({
        where: { isActive: true },
      })
    );

    if (!reservedAtParam) {
      return NextResponse.json(
        tables.map((t) => ({ ...t, available: null }))
      );
    }

    const reservedAt = new Date(reservedAtParam);

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
      { error: "Failed to fetch table list" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiScope("tables");
    if (authResult instanceof NextResponse) return authResult;

    const parsed = await parseBody(request, publicCreateTableSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { label, capacity } = parsed;

    const table = await prisma.restaurantTable.create({
      data: {
        label,
        capacity: capacity ?? 4,
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
        { error: "A table with this label already exists" },
        { status: 409 }
      );
    }

    console.error("POST /api/tables error:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}