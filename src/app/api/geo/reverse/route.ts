import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validations/parse";
import { reverseGeocode } from "@/lib/geocode";
import { getRestaurantSettings } from "@/lib/get-settings";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import {
  currentLocationLimitKm,
  formatKm,
  haversineKm,
  normalizeDeliveryZones,
} from "@/lib/delivery-zones";

/**
 * POST /api/geo/reverse — { lat, lng } → { address, city, state, zip, country, countryCode }
 *
 * Checkout's "Use current location" button. The browser asks the
 * customer for permission and hands us their coordinates; this turns them
 * into address fields the customer can still edit.
 *
 * ⚠️ Safety check first: a location far outside our delivery area is
 * almost always WRONG, not a real customer — a VPN, or a computer without
 * GPS guessing from its internet address. Those get 422 with a clear
 * message and nothing is filled in, so the customer is never shown a
 * stranger's street as "their" address. See currentLocationLimitKm().
 *
 * Open to guests too (guest checkout exists). The lookup goes through our
 * server, not the browser, so the LocationIQ key never reaches the page
 * and Nominatim sees one identified app instead of anonymous visitors.
 *
 * Rate-limited per IP: a real customer taps this once or twice.
 */

const bodySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export async function POST(request: Request) {
  for (const [scope, limit, windowMs] of [
    ["geo-reverse-minute", 6, 60_000],
    ["geo-reverse-hour", 30, 60 * 60_000],
  ] as const) {
    const rate = checkRateLimit(request, scope, { limit, windowMs });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many location lookups — please wait a moment, or type your address." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }
  }

  const parsed = await parseBody(request, bodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const settings = await getRestaurantSettings();
  const origin = {
    lat: settings.restaurantLat ?? RESTAURANT_LOCATION.lat,
    lng: settings.restaurantLng ?? RESTAURANT_LOCATION.lng,
  };
  const distanceKm = haversineKm(origin, { lat: parsed.lat, lng: parsed.lng });
  const limitKm = currentLocationLimitKm(settings.deliveryFeeMode, normalizeDeliveryZones(settings.deliveryZones));

  if (distanceKm > limitKm) {
    return NextResponse.json(
      {
        far: true,
        distanceKm: Math.round(distanceKm),
        error:
          `Your device's location is about ${
            distanceKm >= 100 ? Math.round(distanceKm).toLocaleString("en-US") : formatKm(distanceKm)
          } km from us, outside our delivery area — ` +
          "so we didn't fill it in. This often happens on a computer or with a VPN. Please type your address.",
      },
      { status: 422 }
    );
  }

  const outcome = await reverseGeocode(parsed.lat, parsed.lng);
  if (outcome.ok) return NextResponse.json(outcome.result);

  if (outcome.failure.reason === "not_found") {
    return NextResponse.json(
      { error: "We couldn't find a street address at your location. Please type it in." },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { error: "Address lookup is busy right now. Please type your address." },
    { status: 503 }
  );
}
