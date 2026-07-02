import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * src/lib/reservations.ts
 *
 * All double-booking / overlap-check logic lives here in one place, so
 * /api/tables (showing availability) and /api/reservations (creating a
 * booking) don't each implement the rule separately and drift out of sync.
 *
 * A reservation "occupies" a table for this window:
 *   [reservedAt, reservedAt + RESERVATION_DURATION_MINUTES)
 * A new booking that overlaps this window is treated as a conflict.
 */

export const RESERVATION_DURATION_MINUTES = 90;

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "SEATED"] as const;

type DbClient = typeof prisma | Prisma.TransactionClient;

/**
 * Checks whether a table has room at the given time.
 * (CANCELLED/NO_SHOW/COMPLETED reservations don't block it.)
 *
 * The optional `db` param lets you pass the client from inside a
 * $transaction (tx), so the check + create are genuinely atomic and two
 * simultaneous requests can't create a race condition.
 */
export async function isTableAvailable(
  tableId: string,
  reservedAt: Date,
  opts?: { excludeReservationId?: string; db?: DbClient }
): Promise<boolean> {
  const db = opts?.db ?? prisma;
  const durationMs = RESERVATION_DURATION_MINUTES * 60 * 1000;
  const requestedStart = reservedAt.getTime();
  const requestedEnd = requestedStart + durationMs;

  // Pull reservations in the plausible conflict range and check overlap in
  // JS — this works correctly across any DB without needing raw SQL.
  const windowStart = new Date(requestedStart - durationMs);
  const windowEnd = new Date(requestedEnd + durationMs);

  const nearby = await db.reservation.findMany({
    where: {
      tableId,
      status: { in: [...ACTIVE_STATUSES] },
      reservedAt: { gte: windowStart, lte: windowEnd },
      ...(opts?.excludeReservationId
        ? { id: { not: opts.excludeReservationId } }
        : {}),
    },
    select: { reservedAt: true },
  });

  return !nearby.some((r) => {
    const existingStart = r.reservedAt.getTime();
    const existingEnd = existingStart + durationMs;
    return existingStart < requestedEnd && requestedStart < existingEnd;
  });
}