import { z } from "zod";
import { nonEmptyString } from "@/lib/validations/common";

/**
 * src/lib/validations/reservation.ts
 *
 * Real bug this closes: the old route read `guestCount` straight off the
 * body and only checked `!guestCount` (which lets negative numbers through
 * — `-1` is truthy) then later compared it directly to `table.capacity`
 * with no numeric guarantee. A non-numeric guestCount (e.g. "abc") makes
 * that comparison always false in JS, silently skipping the capacity
 * check, and then `Number(guestCount)` stores NaN in the reservation row.
 * `z.coerce.number().int().positive()` below closes both holes: it forces
 * a real positive integer or fails with a clear 400, before the capacity
 * check or the DB write ever happens.
 */
export const createReservationSchema = z.object({
  tableId: nonEmptyString("Table"),
  customerName: nonEmptyString("Customer name"),
  phone: nonEmptyString("Phone"),
  guestCount: z.coerce.number().int().positive("Guest count must be at least 1"),
  reservedAt: nonEmptyString("Reservation date/time"),
});

/** PATCH /api/reservations/[id] — staff moving a reservation through its
 * lifecycle (confirm, seat, mark a no-show, etc). Same enum values as
 * Prisma's ReservationStatus. */
export const reservationStatusUpdateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
}); 