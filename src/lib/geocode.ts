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

type AddressParts = {
  address?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds a list of queries from most specific to least, so a customer's
 * free-text street line (which Nominatim's index frequently doesn't have
 * verbatim — informal area names, "Road"/"House" numbering conventions
 * common in Bangladeshi addresses, etc.) doesn't sink the whole geocode.
 * Each fallback drops one more of the noisiest fields, ending at
 * city+state+country, which Nominatim can essentially always resolve.
 * A city-level pin for the destination marker is a much better outcome
 * than blocking rider assignment entirely.
 */
function buildQueryCandidates(parts: AddressParts): string[] {
  const { address, apartment, city, state, zip, country } = parts;
  const join = (fields: (string | null | undefined)[]) =>
    fields.filter((p): p is string => !!p && p.trim().length > 0).join(", ");

  const candidates = [
    join([address, apartment, city, state, zip, country]), // full address
    join([address, city, state, zip, country]), // drop apartment
    join([address, city, state, country]), // drop zip too
    join([city, state, zip, country]), // drop street line entirely
    join([city, state, country]), // city-level only
  ];

  // Dedupe (shorter fallbacks can collide with each other when several
  // fields are already empty) while preserving specificity order.
  return [...new Set(candidates)].filter((q) => q.length > 0);
}

async function geocodeQuery(query: string): Promise<GeocodeResult | null> {
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
    // Network error / Nominatim down for this attempt — let the caller's
    // fallback chain keep trying simpler queries.
    return null;
  }
}

/** Server-only — never call this from a client component. */
export async function geocodeAddress(parts: AddressParts): Promise<GeocodeResult | null> {
  const candidates = buildQueryCandidates(parts);
  if (candidates.length === 0) return null;

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) {
      // Nominatim's public instance is rate-limited to ~1 request/second;
      // only the (rare) fallback attempts pay this cost, not the common
      // case where the first, most specific query succeeds.
      await sleep(1100);
    }
    const result = await geocodeQuery(candidates[i]);
    if (result) return result;
  }

  // Every fallback down to city-level failed — caller decides how to
  // handle a null result (currently: reject the assign-rider request with
  // a clear error rather than silently pinning the map at 0,0).
  return null;
}