/**
 * src/lib/geocode.ts
 *
 * Turns an order's free-text address into lat/lng coordinates so the
 * live delivery map (LiveDeliveryMap.tsx) has a destination pin to show
 * next to the rider's position.
 *
 * Uses OpenStreetMap's Nominatim — free, no API key, no billing account
 * needed (unlike the Google Geocoding API), which matters for a feature
 * that's otherwise entirely free to run (Leaflet + OSM tiles for the map
 * itself, see LiveDeliveryMap.tsx). Trade-off: Nominatim's public
 * instance is rate-limited to ~1 request/second and asks for a real
 * User-Agent identifying the app — both handled below. Geocoding only
 * happens once per order (at rider-assignment time, see
 * POST /api/admin/orders/[id]/assign-rider), not on every tracking poll,
 * so this limit is a non-issue in practice.
 *
 * If a restaurant later wants Google's geocoder instead (better accuracy
 * in some regions), swap the fetch URL/response parsing below for the
 * Google Geocoding API — everything downstream (DeliveryTracking model,
 * LiveDeliveryMap) only cares about the resulting { lat, lng }, not which
 * provider produced it.
 */

export type GeocodeResult = { lat: number; lng: number };

/** Server-only — never call this from a client component. */
export async function geocodeAddress(parts: {
  address?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}): Promise<GeocodeResult | null> {
  const query = [parts.address, parts.apartment, parts.city, parts.state, parts.zip, parts.country]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .join(", ");

  if (!query) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim's usage policy requires a real identifying
        // User-Agent — requests without one get silently dropped.
        "User-Agent": "cuisine-fullstack-delivery-tracking/1.0",
      },
      // Assignment is an admin-initiated action, not a hot path — no
      // need to cache, and caching a wrong/stale geocode would be worse
      // than re-fetching.
      cache: "no-store",
    });
    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch {
    // Network error / Nominatim down — caller decides how to handle a
    // null result (currently: reject the assign-rider request with a
    // clear error rather than silently pinning the map at 0,0).
    return null;
  }
}
