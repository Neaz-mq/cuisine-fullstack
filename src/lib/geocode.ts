/**
 * src/lib/geocode.ts
 *
 * Turns an order's free-text address into lat/lng coordinates so the
 * live delivery map (LiveDeliveryMap.tsx) has a destination pin to show
 * next to the rider's position.
 *
 * Uses LocationIQ when LOCATIONIQ_API_KEY is set, with OpenStreetMap's
 * public Nominatim as the backup (see PROVIDERS below). Nominatim is free, no API key, no billing account
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
 *
 * Each fallback drops one more field, ending at just city+country, which
 * Nominatim can essentially always resolve for any real city. Critically,
 * `state` is dropped on its own step (not just alongside apartment/zip) —
 * checkout has a free-text state field, and a customer typing a locality
 * name into it (rather than an actual division/state) produces a value
 * Nominatim doesn't recognize. Keeping that bad value in EVERY fallback
 * would poison the whole chain even though "city, country" alone (e.g.
 * "Bogura, Bangladesh") would resolve fine — this is what happened before
 * this fix: every candidate still included state, so none of them worked.
 *
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
    join([address, city, zip, country]), // drop state (bad/garbage state value)
    join([address, city, country]), // drop state and zip
    join([city, state, zip, country]), // drop street line, keep state
    join([city, zip, country]), // drop street line and state
    join([city, state, country]), // city + state, no street
    join([city, country]), // last resort — city-level only
  ];

  // Dedupe (shorter fallbacks can collide with each other when several
  // fields are already empty) while preserving specificity order.
  return [...new Set(candidates)].filter((q) => q.length > 0);
}

/**
 * Why a lookup failed — shown to staff instead of a vague "not found".
 *
 *   not_found — the service answered, and nothing matched any version of
 *               the address.
 *   refused   — the service said no (429 = too many requests, 403 =
 *               blocked). Common on a dev machine after many test orders,
 *               or behind a VPN such as Cloudflare WARP.
 *   network   — no answer at all (offline, DNS, timeout).
 */
export type GeocodeFailure =
  | { reason: "not_found" }
  | { reason: "refused"; status: number }
  | { reason: "network"; detail: string };

type QueryOutcome =
  | { ok: true; result: GeocodeResult }
  | { ok: false; failure: GeocodeFailure };

/**
 * Two providers, tried in order. Both use OpenStreetMap data, so they find
 * the same places — the difference is reliability:
 *
 *   LocationIQ  — needs a free API key (LOCATIONIQ_API_KEY). 5,000 lookups
 *                 a day, 2 per second, a service meant for apps. Used first
 *                 when the key is set. Free-plan terms ask for a visible
 *                 "Search by LocationIQ" link somewhere in the app.
 *   Nominatim   — OpenStreetMap's own public server. No key, but ~1 per
 *                 second, and it throttles or blocks busy or anonymous
 *                 callers. Used as the backup (or alone, with no key).
 *
 * A provider that refuses or can't be reached hands over to the next one;
 * "not found" does not, because both search the same map data.
 */
type Provider = {
  name: string;
  /** Minimum gap between two real requests, per the provider's limits. */
  gapMs: number;
  buildUrl: (query: string) => string;
  headers: Record<string, string>;
  /** LocationIQ answers "nothing matched" with HTTP 404 instead of []. */
  notFoundStatus?: number;
};

/**
 * Nominatim's usage policy asks every app to identify itself with a
 * User-Agent AND a way to contact the owner. Anonymous-looking traffic is
 * the first to be throttled or blocked. Set NOMINATIM_EMAIL in .env to
 * your real email; it goes in the User-Agent and in the `email` parameter
 * Nominatim documents for exactly this purpose.
 */
const CONTACT_EMAIL = process.env.NOMINATIM_EMAIL?.trim() || "";
const USER_AGENT = CONTACT_EMAIL
  ? `cuisine-fullstack-delivery-tracking/1.0 (${CONTACT_EMAIL})`
  : "cuisine-fullstack-delivery-tracking/1.0";

const LOCATIONIQ_KEY = process.env.LOCATIONIQ_API_KEY?.trim() || "";

const PROVIDERS: Provider[] = [
  ...(LOCATIONIQ_KEY
    ? [
        {
          name: "LocationIQ",
          gapMs: 600,
          buildUrl: (query: string) => {
            const url = new URL("https://us1.locationiq.com/v1/search");
            url.searchParams.set("key", LOCATIONIQ_KEY);
            url.searchParams.set("q", query);
            url.searchParams.set("format", "json");
            url.searchParams.set("limit", "1");
            return url.toString();
          },
          headers: { "Accept-Language": "en" },
          notFoundStatus: 404,
        },
      ]
    : []),
  {
    name: "Nominatim",
    gapMs: 1100,
    buildUrl: (query: string) => {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);
      return url.toString();
    },
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  },
];

/**
 * Same address typed again (the checkout quote, then checkout, then the
 * rider assignment) doesn't hit a service again. Per server instance,
 * cleared on restart; addresses don't move, so there's nothing to expire.
 * Only real answers are cached — a refusal is retried next time.
 */
const cache = new Map<string, GeocodeResult | "none">();

async function geocodeQuery(provider: Provider, query: string): Promise<QueryOutcome> {
  try {
    const res = await fetch(provider.buildUrl(query), {
      headers: provider.headers,
      cache: "no-store",
      // A hung request used to stall checkout / rider assignment with no
      // end. 8 seconds, then give up.
      signal: AbortSignal.timeout(8000),
    });

    if (provider.notFoundStatus && res.status === provider.notFoundStatus) {
      return { ok: false, failure: { reason: "not_found" } };
    }
    if (!res.ok) {
      console.warn(
        `[geocode] ${provider.name} answered HTTP ${res.status} for "${query}".` +
          (res.status === 429 || res.status === 403
            ? " It is refusing requests from this server (too many, or blocked)."
            : "") +
          (provider.name === "Nominatim" && !LOCATIONIQ_KEY
            ? " Set LOCATIONIQ_API_KEY in .env for a reliable provider."
            : "")
      );
      return { ok: false, failure: { reason: "refused", status: res.status } };
    }

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = Array.isArray(results) ? results[0] : undefined;
    const lat = first ? parseFloat(first.lat) : NaN;
    const lng = first ? parseFloat(first.lon) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return { ok: false, failure: { reason: "not_found" } };
    }
    return { ok: true, result: { lat, lng } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[geocode] Could not reach ${provider.name} for "${query}": ${detail}`);
    return { ok: false, failure: { reason: "network", detail } };
  }
}

/** One provider, every version of the address, most specific first. */
async function geocodeWith(
  provider: Provider,
  candidates: string[]
): Promise<QueryOutcome> {
  let calledBefore = false;
  for (const query of candidates) {
    const cached = cache.get(query);
    if (cached === "none") continue;
    if (cached) return { ok: true, result: cached };

    if (calledBefore) await sleep(provider.gapMs);
    calledBefore = true;

    const outcome = await geocodeQuery(provider, query);
    if (outcome.ok) {
      cache.set(query, outcome.result);
      return outcome;
    }
    // ⚠️ A refusal or network error is about the connection, not the
    // address — the other versions would fail the same way, and hammering
    // a service that is already throttling only extends the block.
    if (outcome.failure.reason !== "not_found") return outcome;
  }
  return { ok: false, failure: { reason: "not_found" } };
}

/**
 * Tries each provider in turn and says why it failed if none worked.
 * Only a real "not found" from a provider that answered is remembered, so
 * the next attempt skips versions that are known not to exist.
 */
export async function geocodeAddressDetailed(
  parts: AddressParts
): Promise<{ ok: true; result: GeocodeResult } | { ok: false; failure: GeocodeFailure }> {
  const candidates = buildQueryCandidates(parts);
  if (candidates.length === 0) return { ok: false, failure: { reason: "not_found" } };

  let lastFailure: GeocodeFailure = { reason: "not_found" };
  for (const provider of PROVIDERS) {
    const outcome = await geocodeWith(provider, candidates);
    if (outcome.ok) return outcome;
    lastFailure = outcome.failure;
    if (outcome.failure.reason === "not_found") {
      candidates.forEach((query) => cache.set(query, "none"));
      break;
    }
  }
  return { ok: false, failure: lastFailure };
}

/** Same as geocodeAddressDetailed, for callers that only need yes / no. */
export async function geocodeAddress(parts: AddressParts): Promise<GeocodeResult | null> {
  const outcome = await geocodeAddressDetailed(parts);
  return outcome.ok ? outcome.result : null;
}

/* ────────────────────────────────────────────────────────────────────────
 * Reverse geocoding — coordinates → address.
 *
 * Used by checkout's "Use my current location" button: the browser gives
 * lat/lng (after the customer allows it), and this turns that into the
 * same Address / City / State / Zip fields the customer would have typed.
 *
 * Same two providers, same order, same contact details as the forward
 * lookup above. The coordinates themselves are never stored or trusted
 * for money: checkout still geocodes the address that ends up in the
 * form, so the delivery fee is decided exactly as for a typed address.
 * ──────────────────────────────────────────────────────────────────────── */

export type ReverseAddress = {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  /** ISO 3166-1 alpha-2, upper case ("BD"), or "" if unknown. */
  countryCode: string;
};

/** The `address` object both OpenStreetMap services return. */
export type OsmAddress = Partial<
  Record<
    | "house_number"
    | "house_name"
    | "building"
    | "road"
    | "pedestrian"
    | "residential"
    | "neighbourhood"
    | "quarter"
    | "suburb"
    | "hamlet"
    | "city_district"
    | "city"
    | "town"
    | "village"
    | "municipality"
    | "county"
    | "state_district"
    | "state"
    | "region"
    | "postcode"
    | "country"
    | "country_code",
    string
  >
>;

/**
 * Turns an OpenStreetMap address into checkout fields.
 *
 * Street line = house number + road, then the local area ("House 12,
 * Road 11, Banani") — in Bangladesh and much of South Asia the area name
 * is what a rider actually navigates by, so it is kept even when there
 * is a road. City falls back through town/village/district because OSM
 * tags smaller places differently. Duplicates (area == city) are dropped.
 */
export function addressFromOsm(osm: OsmAddress): ReverseAddress {
  const clean = (value?: string) => (value ?? "").trim();
  const city =
    clean(osm.city) ||
    clean(osm.town) ||
    clean(osm.village) ||
    clean(osm.municipality) ||
    clean(osm.city_district) ||
    clean(osm.county);
  const state = clean(osm.state) || clean(osm.state_district) || clean(osm.region);

  const street = clean(osm.road) || clean(osm.pedestrian) || clean(osm.residential);
  const houseNumber = clean(osm.house_number);
  const house = clean(osm.house_name) || clean(osm.building);
  const area = clean(osm.neighbourhood) || clean(osm.quarter) || clean(osm.suburb) || clean(osm.hamlet);

  const parts: string[] = [];
  const push = (value: string) => {
    if (value && !parts.some((p) => p.toLowerCase() === value.toLowerCase()) && value.toLowerCase() !== city.toLowerCase()) {
      parts.push(value);
    }
  };
  push(house);
  push(houseNumber && street ? `${houseNumber} ${street}` : houseNumber || street);
  push(area);

  return {
    address: parts.join(", "),
    city,
    state,
    zip: clean(osm.postcode),
    country: clean(osm.country),
    countryCode: clean(osm.country_code).toUpperCase(),
  };
}

type ReverseProvider = {
  name: string;
  buildUrl: (lat: number, lng: number) => string;
  headers: Record<string, string>;
};

const REVERSE_PROVIDERS: ReverseProvider[] = [
  ...(LOCATIONIQ_KEY
    ? [
        {
          name: "LocationIQ",
          buildUrl: (lat: number, lng: number) => {
            const url = new URL("https://us1.locationiq.com/v1/reverse");
            url.searchParams.set("key", LOCATIONIQ_KEY);
            url.searchParams.set("lat", String(lat));
            url.searchParams.set("lon", String(lng));
            url.searchParams.set("format", "json");
            url.searchParams.set("addressdetails", "1");
            url.searchParams.set("normalizeaddress", "1");
            return url.toString();
          },
          headers: { "Accept-Language": "en" },
        },
      ]
    : []),
  {
    name: "Nominatim",
    buildUrl: (lat: number, lng: number) => {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("zoom", "18");
      if (CONTACT_EMAIL) url.searchParams.set("email", CONTACT_EMAIL);
      return url.toString();
    },
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  },
];

/**
 * ~1 m precision is plenty for a doorstep, and rounding lets a second tap
 * from the same spot come straight from memory.
 */
const reverseCache = new Map<string, ReverseAddress>();

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ ok: true; result: ReverseAddress } | { ok: false; failure: GeocodeFailure }> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = reverseCache.get(key);
  if (hit) return { ok: true, result: hit };

  let lastFailure: GeocodeFailure = { reason: "not_found" };
  for (const provider of REVERSE_PROVIDERS) {
    try {
      const res = await fetch(provider.buildUrl(lat, lng), {
        headers: provider.headers,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      // LocationIQ answers "nothing here" (open sea, desert) with 404.
      if (res.status === 404) return { ok: false, failure: { reason: "not_found" } };
      if (!res.ok) {
        console.warn(`[geocode] ${provider.name} reverse lookup answered HTTP ${res.status}.`);
        lastFailure = { reason: "refused", status: res.status };
        continue;
      }
      const data = (await res.json()) as { address?: OsmAddress; error?: string };
      if (!data?.address || data.error) return { ok: false, failure: { reason: "not_found" } };

      const result = addressFromOsm(data.address);
      if (!result.city && !result.address) return { ok: false, failure: { reason: "not_found" } };
      reverseCache.set(key, result);
      return { ok: true, result };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[geocode] Could not reach ${provider.name} for a reverse lookup: ${detail}`);
      lastFailure = { reason: "network", detail };
    }
  }
  return { ok: false, failure: lastFailure };
}
