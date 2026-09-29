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

/** Rider panel → Profile → Vehicle. Empty text clears a field. */
export const RIDER_VEHICLE_TYPES = ["Motorbike", "Scooter", "Bicycle", "Car", "On foot"] as const;

export const riderVehicleSchema = z.object({
  vehicleType: z.union([z.enum(RIDER_VEHICLE_TYPES), z.literal("")]),
  vehicleModel: z.string().trim().max(80, "Keep the model under 80 characters"),
  vehiclePlate: z
    .string()
    .trim()
    .max(30, "Keep the number plate under 30 characters")
    .transform((value) => value.toUpperCase()),
});

/** Rider panel → Cash Out → Payout Method (bank account or mobile wallet). */
export const payoutMethodSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BANK"),
    bankName: z.string().trim().min(2, "Enter the bank's name").max(80),
    accountName: z.string().trim().min(2, "Enter the name on the account").max(80),
    accountNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^\d{6,20}$/, "Account number should be 6–20 digits")),
  }),
  z.object({
    kind: z.literal("WALLET"),
    provider: z.enum(["bKash", "Nagad", "Rocket", "Upay"]),
    number: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^(\+?88)?01\d{9}$/, "Enter the 11-digit wallet number, e.g. 01712345678")),
  }),
]);

/** Rider panel → Cash Out → Confirm. Amount in the restaurant's currency. */
export const payoutRequestSchema = z.object({
  amount: z.number().positive("Enter an amount above zero").max(1_000_000),
  method: z.enum(["BANK", "WALLET"]),
});

/** Admin → Rider Payouts: mark a request paid, or reject it. */
export const payoutDecisionSchema = z.object({
  action: z.enum(["PAID", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});
