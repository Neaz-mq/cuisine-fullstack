/**
 * src/lib/rider-preferences.ts
 *
 * Rider panel → Settings: what a rider wants to be offered and told about.
 * Plain values only (no database code), shared by the Settings form, its
 * API and the Available Orders query.
 *
 *   Max Delivery Radius   waiting orders whose drop-off is at most this far
 *                         from the kitchen (orders with no distance on file
 *                         are always shown — we can't judge them)
 *   Order Types Accepted  all orders, or online-paid only (no cash to carry)
 *   New Order Alerts      waiting orders in the notification list + badge
 *   Earnings Summary      an email at the end of each day they delivered
 */
import type { Prisma } from "@/generated/prisma/client";

export type RiderPreferences = {
  maxRadiusKm: number | null;
  acceptsCash: boolean;
  newOrderAlerts: boolean;
  earningsSummary: boolean;
};

export const DEFAULT_RIDER_PREFERENCES: RiderPreferences = {
  maxRadiusKm: null,
  acceptsCash: true,
  newOrderAlerts: true,
  earningsSummary: true,
};

export const RADIUS_OPTIONS = [
  { value: "", label: "Any distance" },
  { value: "3", label: "3 Km" },
  { value: "5", label: "5 Km" },
  { value: "8", label: "8 Km" },
  { value: "10", label: "10 Km" },
  { value: "15", label: "15 Km" },
] as const;

export const RADIUS_VALUES = [3, 5, 8, 10, 15] as const;

export const ORDER_TYPE_OPTIONS = [
  { value: "ALL", label: "Food Delivery — cash & online" },
  { value: "ONLINE_ONLY", label: "Food Delivery — online-paid only" },
] as const;

/** Extra conditions on "waiting for a rider" for this rider's settings. */
export function availableOrderFilter(prefs: RiderPreferences): Prisma.OrderWhereInput[] {
  const filters: Prisma.OrderWhereInput[] = [];
  if (prefs.maxRadiusKm !== null) {
    filters.push({ OR: [{ deliveryDistanceKm: null }, { deliveryDistanceKm: { lte: prefs.maxRadiusKm } }] });
  }
  if (!prefs.acceptsCash) filters.push({ paymentMethod: "ONLINE" });
  return filters;
}

/** The same rule for an order already loaded (tests, client lists). */
export function matchesPreferences(
  order: { distanceKm: number | null; paymentMethod: "COD" | "ONLINE" },
  prefs: RiderPreferences
): boolean {
  if (prefs.maxRadiusKm !== null && order.distanceKm !== null && order.distanceKm > prefs.maxRadiusKm) return false;
  if (!prefs.acceptsCash && order.paymentMethod === "COD") return false;
  return true;
}
