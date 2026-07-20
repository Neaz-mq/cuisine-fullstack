import { z } from "zod";

/**
 * src/lib/validations/delivery.ts
 *
 * Validation for the in-house delivery / rider-tracking feature — kept in
 * its own file rather than appended to validations/order.ts since none of
 * this overlaps with the general order-status schema there.
 */

/** POST /api/admin/orders/[id]/assign-rider */
export const assignRiderSchema = z.object({
  riderId: z.string().trim().min(1, "Select a rider"),
});

/** POST /api/rider/deliveries/[orderId]/location — rider's browser posts
 * its current GPS fix. Latitude/longitude bounds are the real physical
 * limits (not just "any number"), which also catches an accidentally
 * swapped lat/lng before it corrupts the DB row. */
export const riderLocationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
