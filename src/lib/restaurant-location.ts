/**
 * src/lib/restaurant-location.ts
 *
 * The restaurant's own fixed location — unlike a customer's delivery
 * address (geocoded fresh per order in lib/geocode.ts), this doesn't
 * change, so it's a plain constant rather than a DB lookup or an API
 * call. Coordinates from OpenStreetMap (Jaleshwaritola locality, Bogra
 * Sadar Upazila, Bogura, Bangladesh).
 *
 * Used as the rider's starting position at assign-rider time (see
 * POST /api/admin/orders/[id]/assign-rider) — before the rider's phone
 * has reported a real GPS position, the live map should show them at
 * the restaurant (where a delivery actually starts), not incorrectly
 * pinned at the customer's own address.
 */
export const RESTAURANT_LOCATION = {
  label: "Jaleshwaritola, Bogura",
  lat: 24.84491,
  lng: 89.37532,
} as const;