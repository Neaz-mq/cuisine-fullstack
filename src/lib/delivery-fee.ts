import { geocodeAddress, type GeocodeResult } from "@/lib/geocode";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import {
  haversineKm,
  normalizeDeliveryZones,
  resolveDeliveryZone,
  formatKm,
  type DeliveryZone,
} from "@/lib/delivery-zones";

/**
 * src/lib/delivery-fee.ts
 *
 * "এই ঠিকানায় delivery charge কত?" — server-only, একটাই উত্তর, একটাই
 * জায়গা। /api/checkout/quote, /api/orders আর
 * /api/checkout/create-session — তিনটেই এটাই ডাকে, ঠিক যেভাবে তিনটেই
 * একই calculateOrderPricing() ডাকে।
 *
 * ⚠️ তিন জায়গায় তিনবার লিখলে একদিন quote-এ এক ফি আর charge-এ আরেক ফি
 * হতো — আর সেটা ধরা পড়ত টাকা কেটে নেওয়ার পরে। lib/pricing.ts-এর
 * header-এ ঠিক এই ভুলটার গল্পই লেখা আছে।
 *
 * ── কেন geocode-এর ফল cache করা হয় ──────────────────────────────────
 *
 * Carts.tsx প্রতিটা cart পরিবর্তনে /api/checkout/quote ডাকে (৩০০ms
 * debounce সহ) — একজন খদ্দের সহজেই ২০–৪০টা quote চান। Nominatim-এর
 * public instance সেকেন্ডে ~১টা request নেয়, আর lib/geocode.ts ব্যর্থ
 * হলে ৯ ধাপ পর্যন্ত fallback করে, প্রতিটার মাঝে ১.১s ঘুম।
 *
 * অর্থাৎ cache ছাড়া একটা checkout একাই Nominatim-কে ছাড়িয়ে যেত, আর
 * খদ্দের প্রতিটা keystroke-এ কয়েক সেকেন্ড অপেক্ষা করতেন। তাই
 * ঠিকানার normalize করা রূপকে key ধরে ফলটা ধরে রাখা হয় — একই খদ্দের
 * ২০ বার quote চাইলেও geocode হয় একবার।
 *
 * ⚠️ cache-টা process-local, ঠিক lib/rate-limit.ts-এর মতো, আর একই
 * সীমাবদ্ধতা নিয়ে: serverless-এ প্রতিটা instance-এর নিজের copy। সেটা
 * এখানে সমস্যা নয় — একজন খদ্দেরের একটা checkout session সাধারণত
 * একটাই instance-এ পড়ে, আর miss হলে সবচেয়ে খারাপ ফল একটা বাড়তি
 * geocode call।
 */

// ---------------------------------------------------------------------------
// Geocode cache
// ---------------------------------------------------------------------------

type CacheEntry = { value: GeocodeResult | null; expiresAt: number };

const GEOCODE_CACHE_TTL_MS = 30 * 60_000; // ৩০ মিনিট — একটা checkout-এর চেয়ে ঢের বেশি
const GEOCODE_CACHE_MAX = 500;

const geocodeCache = new Map<string, CacheEntry>();

/**
 * ⚠️ ব্যর্থ geocode-ও cache হয় (`value: null`), আর সেটাই আসল লাভ।
 *
 * ব্যর্থতাটাই সবচেয়ে দামি: ৯টা fallback query, মাঝে ৮ × ১.১s ঘুম,
 * অর্থাৎ প্রায় ৯ সেকেন্ড। খদ্দের অসম্পূর্ণ ঠিকানা টাইপ করতে করতে
 * quote চাইলে সেটা প্রতিবার ঘটত।
 */
function readCache(key: string): CacheEntry | undefined {
  const hit = geocodeCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    geocodeCache.delete(key);
    return undefined;
  }
  return hit;
}

function writeCache(key: string, value: GeocodeResult | null) {
  // সরল LRU-এর বদলে সরল ছাঁটাই: ভরে গেলে সবচেয়ে পুরোনো ঢোকানো
  // entry-টা বাদ (Map সন্নিবেশের ক্রম ধরে রাখে)। এটা নিখুঁত LRU নয়,
  // কিন্তু উদ্দেশ্যটা কেবল স্মৃতি অসীম হতে না দেওয়া।
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, { value, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
}

export interface DeliveryAddressParts {
  address?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

function cacheKey(parts: DeliveryAddressParts): string {
  return [parts.address, parts.apartment, parts.city, parts.state, parts.zip, parts.country]
    .map((p) => (p ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * ঠিকানাটা geocode করার মতো যথেষ্ট ভরা কিনা।
 *
 * খদ্দের এখনো টাইপ করছেন — "Dh" লেখা অবস্থায় Nominatim-এ পাঠানোর
 * কোনো মানে নেই। lib/geocode.ts-এর fallback শৃঙ্খলার শেষ ধাপটাই
 * `city, country`, তাই ওই দুটোই ন্যূনতম শর্ত।
 */
export function isGeocodable(parts: DeliveryAddressParts): boolean {
  return Boolean(parts.city?.trim() && parts.country?.trim());
}

async function cachedGeocode(parts: DeliveryAddressParts): Promise<GeocodeResult | null> {
  const key = cacheKey(parts);
  const hit = readCache(key);
  if (hit) return hit.value;

  const result = await geocodeAddress(parts);
  writeCache(key, result);
  return result;
}

/**
 * পরে কোনো ঠিকানা বদলালে (admin edit, ভুল সংশোধন) cache-টা বাসি না
 * রাখার জন্য। এখন কোথাও ডাকা হয় না, কিন্তু cache যেখানে আছে সেখানে
 * তা মোছার উপায়ও থাকা উচিত — নাহলে একদিন কেউ process restart-কেই
 * সমাধান বানিয়ে ফেলবে।
 */
export function forgetGeocode(parts: DeliveryAddressParts): void {
  geocodeCache.delete(cacheKey(parts));
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** RestaurantSettings-এর যতটুকু এই হিসাবের জন্য লাগে। */
export interface DeliveryFeeSettings {
  deliveryFeeMode: "FLAT" | "DISTANCE";
  deliveryFeeFlat: number | string | { toString(): string };
  deliveryZones: unknown;
  restaurantLat: number | null;
  restaurantLng: number | null;
}

export type DeliveryFeeResolution =
  | {
      ok: true;
      /** pricing.ts-এ পাঠানোর ফি (currency-র মূল একক, number)। */
      fee: number;
      /** DISTANCE mode-এ মাপা দূরত্ব; FLAT বা geocode ব্যর্থ হলে null। */
      distanceKm: number | null;
      /** খদ্দেরের স্থানাঙ্ক — Order-এ সংরক্ষিত হয় (নিচে দ্রষ্টব্য)। */
      coords: GeocodeResult | null;
      /** এই অর্ডারে যে ধাপটা বসেছে; FLAT/fallback-এ null। */
      zone: DeliveryZone | null;
      /** অর্ডারে snapshot হয়ে যাওয়া পুরো সিঁড়িটা। */
      zones: DeliveryZone[];
      /** DISTANCE mode, কিন্তু দূরত্ব মাপা যায়নি বলে flat বসেছে। */
      fellBackToFlat: boolean;
    }
  | {
      ok: false;
      /** খদ্দেরকে দেখানোর মতো বার্তা। */
      error: string;
      code: "OUT_OF_RANGE";
    };

function toNumber(value: DeliveryFeeSettings["deliveryFeeFlat"]): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * এই অর্ডারের delivery charge।
 *
 * ── সিদ্ধান্তগুলো, আর কেন ────────────────────────────────────────────
 *
 * ১. DINE_IN কখনো এখানে আসে না — caller আগেই বাদ দেয়। কিছু কোথাও
 *    যাচ্ছে না, তাই দূরত্বেরও প্রশ্ন নেই।
 *
 * ২. mode FLAT হলে geocode-ই করা হয় না। পুরোনো আচরণ হুবহু অক্ষুণ্ণ,
 *    আর যে দোকান দূরত্ব-ভিত্তিক ফি চায় না তাকে Nominatim-এর উপর
 *    নির্ভরশীল করে দেওয়ার কোনো কারণ নেই।
 *
 * ৩. ⚠️ geocode ব্যর্থ হলে checkout **থামানো হয় না** — flat ফি বসে
 *    আর `fellBackToFlat` তোলা হয়।
 *
 *    এটা একটা সচেতন বাণিজ্যিক আপস। Nominatim বাইরের একটা বিনামূল্যের
 *    সেবা; সেটা কয়েক মিনিট বসে গেলে রেস্তোরাঁর সব অর্ডার নেওয়া বন্ধ
 *    হয়ে যাওয়াটা ফি ভুল হওয়ার চেয়ে অনেক বড় ক্ষতি। foodpanda-জাতীয়
 *    অ্যাপ এখানে আটকে দেয়, কিন্তু তাদের হাতে map-picker আছে — খদ্দের
 *    পিন বসিয়ে দেন, free-text ঠিকানা নয়। আমাদের নেই।
 *
 *    ব্যাপারটা লুকানো হয় না: flag-টা Order-এ snapshot হয়ে dispatch
 *    modal-এ "distance unavailable" হিসেবে দেখা যায়, তাই staff জানেন
 *    কোন অর্ডারে ফি-টা অনুমান।
 *
 * ৪. উল্টোদিকে OUT_OF_RANGE-এ checkout **থামে**। ওটা বাইরের সেবার
 *    ব্যর্থতা নয়, owner-এর নিজের নিয়ম: "আমরা এত দূরে যাই না।" নীরবে
 *    flat ফি বসিয়ে অর্ডার নিয়ে নিলে খাবারটা কেউ পৌঁছে দিতে পারত না।
 */
export async function resolveDeliveryFee(
  parts: DeliveryAddressParts,
  settings: DeliveryFeeSettings
): Promise<DeliveryFeeResolution> {
  const flat = toNumber(settings.deliveryFeeFlat);
  const zones = normalizeDeliveryZones(settings.deliveryZones);

  if (settings.deliveryFeeMode !== "DISTANCE") {
    return {
      ok: true,
      fee: flat,
      distanceKm: null,
      coords: null,
      zone: null,
      zones,
      fellBackToFlat: false,
    };
  }

  const origin = {
    lat: settings.restaurantLat ?? RESTAURANT_LOCATION.lat,
    lng: settings.restaurantLng ?? RESTAURANT_LOCATION.lng,
  };

  const coords = isGeocodable(parts) ? await cachedGeocode(parts) : null;

  if (!coords) {
    return {
      ok: true,
      fee: flat,
      distanceKm: null,
      coords: null,
      zone: null,
      zones,
      fellBackToFlat: true,
    };
  }

  const distanceKm = haversineKm(origin, coords);
  const match = resolveDeliveryZone(distanceKm, zones);

  if (!match.ok) {
    return {
      ok: false,
      code: "OUT_OF_RANGE",
      // ⚠️ কোনো currency চিহ্ন নেই, ইচ্ছাকৃতভাবে — এটা দূরত্বের বার্তা,
      // টাকার নয়। order-checkout-shared.ts-এর minOrderValue বার্তাতেও
      // একই কারণে চিহ্ন বাদ দেওয়া আছে।
      error: `Sorry, we only deliver within ${formatKm(match.maxKm)} km. This address is about ${formatKm(distanceKm)} km away.`,
    };
  }

  return {
    ok: true,
    fee: match.zone.fee,
    distanceKm,
    coords,
    zone: match.zone,
    zones,
    fellBackToFlat: false,
  };
}

/**
 * Resolution → Order row-তে লেখার মতো ক্ষেত্রগুলো।
 *
 * ⚠️ পুরো সিঁড়িটা `deliveryZones`-এ snapshot হয়, শুধু মিলে যাওয়া
 * ধাপটা নয়। কারণ owner আগামীকাল দাম বদলাবেন, আর তখন গতকালের
 * অর্ডারের dispatch modal-এ আজকের তালিকা দেখানো মানে মিথ্যা বলা —
 * "এই অর্ডারে $7 বসেছিল" লেখা থাকবে, অথচ পাশের চিপে $9। taxRate,
 * taxName আর currencyMinorUnits ঠিক এই একই কারণে Order-এ snapshot
 * করা আছে; এটা সেই ধারারই ধারাবাহিকতা।
 *
 * ⚠️ স্থানাঙ্ক দুটোও রাখা হয়, আর সেটার দ্বিতীয় একটা লাভ আছে:
 * assign-rider route এখন আর নতুন করে geocode করবে না — checkout-এই
 * মাপা মানটা DeliveryTracking.destLat/destLng-তে বসিয়ে দিতে পারে।
 * এক অর্ডারে দুবার Nominatim ডাকার কোনো কারণ নেই, আর dispatch-এর
 * সময় ওই call-টাই মাঝেমধ্যে ব্যর্থ হয়ে rider পাঠানো আটকে দিত।
 */
export function deliveryFieldsForOrder(resolution: Extract<DeliveryFeeResolution, { ok: true }>) {
  return {
    deliveryLat: resolution.coords?.lat ?? null,
    deliveryLng: resolution.coords?.lng ?? null,
    deliveryDistanceKm: resolution.distanceKm,
    deliveryZoneLabel: resolution.zone?.label ?? null,
    deliveryZoneFallback: resolution.fellBackToFlat,
    // Prisma Json column — DeliveryZone[]-এর সরল রূপ।
    deliveryZones: resolution.zones as unknown as object,
  };
}
