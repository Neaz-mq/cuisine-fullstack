import { z } from "zod";
import { profileSchema } from "@/lib/validations/account";

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

/** Rider panel → Cash Collected → "Hand In Cash": the rider reports cash handed to the restaurant. */
export const cashHandInSchema = z.object({
  amount: z.number().positive("Enter an amount above zero").max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Rider cancels a hand-in report the restaurant hasn't confirmed yet. */
export const cashHandInCancelSchema = z.object({
  action: z.literal("CANCEL"),
});

/** Admin → Rider Cash → "Record Cash": cash the owner received, recorded directly. */
export const cashRecordSchema = z.object({
  riderId: z.string().trim().min(1, "Select a rider"),
  amount: z.number().positive("Enter an amount above zero").max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Admin → Rider Cash: confirm a rider's hand-in report, or dispute it (a reason is required). */
export const cashDecisionSchema = z
  .object({
    action: z.enum(["CONFIRM", "DISPUTE"]),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.action !== "DISPUTE" || Boolean(value.note), {
    message: "Say why you're disputing it — the rider will see this",
    path: ["note"],
  });

/**
 * Rider panel → My Profile → "Save Change" (profile + vehicle in one go).
 * Name, phone, date of birth and gender follow the customer profile rules;
 * `phone` is the work phone (StaffProfile.phone) customers may see.
 * `nid` is only accepted while none is on file — after that the
 * restaurant changes it (it's an identity document).
 */
export const riderProfileSchema = profileSchema.extend({
  address: z.string().trim().max(200, "Keep the address under 200 characters"),
  nid: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || /^\d{10}$|^\d{13}$|^\d{17}$/.test(value.replace(/\s+/g, "")), "NID should be 10, 13 or 17 digits")
    .transform((value) => value.replace(/\s+/g, ""))
    .optional()
    .default(""),
  drivingLicenseNumber: z
    .string()
    .trim()
    .max(30, "Keep the licence number under 30 characters")
    .transform((value) => value.toUpperCase()),
}).merge(riderVehicleSchema);

/** Staff page → rider's documents: approve, or reject with a reason. */
export const documentDecisionSchema = z
  .object({
    action: z.enum(["VERIFIED", "REJECTED"]),
    note: z.string().trim().max(300).optional().default(""),
  })
  .refine((value) => value.action === "VERIFIED" || value.note.length > 0, {
    message: "Tell the rider why, so they can fix it",
    path: ["note"],
  });

/** Rider panel → Settings → Delivery Preferences + Notifications. */
export const riderPreferencesSchema = z.object({
  maxRadiusKm: z.union([z.null(), z.literal(3), z.literal(5), z.literal(8), z.literal(10), z.literal(15)]),
  acceptsCash: z.boolean(),
  newOrderAlerts: z.boolean(),
  earningsSummary: z.boolean(),
});
