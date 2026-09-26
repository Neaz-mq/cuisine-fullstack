/**
 * src/lib/delivery-zones.ts
 *
 * দূরত্ব-ভিত্তিক delivery charge-এর **বিশুদ্ধ** যুক্তি — কোনো Prisma
 * নেই, কোনো fetch নেই, কোনো Decimal নেই।
 *
 * ⚠️ এই file-টা client component-ও import করে (dispatch modal-এর
 * চিপগুলো), তাই lib/money.ts বা generated Prisma client এখানে ছোঁয়া
 * যাবে না — ওরা `node:module` টানে, আর browser bundle-এ তার অস্তিত্ব
 * নেই। lib/currency-format.ts আর lib/loyalty-tiers.ts-এর header-এ ঠিক
 * একই সতর্কতা, আর এই প্রজেক্টে সেটা একবার `next build` থামিয়েছিল।
 *
 * তাই এখানকার সব অঙ্ক `number`। টাকার আসল হিসাব (round, tax, total)
 * হয় lib/pricing.ts-এ, Decimal-এ — এখান থেকে কেবল "কোন ধাপ, কত ফি"
 * সিদ্ধান্তটা যায়।
 *
 * ── ধাপের আকৃতি: সিঁড়ি, জোড়া-জোড়া সীমা নয় ─────────────────────────
 *
 * প্রতিটা ধাপে শুধু `upToKm` আর `fee` — `fromKm` লেখা হয় না, আগের
 * ধাপের `upToKm` থেকেই বেরিয়ে আসে।
 *
 * কারণটা গুরুত্বপূর্ণ: দুটো সীমা হাতে লিখতে দিলে owner একদিন
 * `[0–3]` আর `[5–8]` বসাবেন, আর ৪ কিমি দূরের খদ্দেরের অর্ডারে কোনো
 * ধাপই মিলবে না — নীরবে ফি শূন্য। সিঁড়ি হিসেবে রাখলে ফাঁক বা
 * পরস্পর-ছেদ তৈরি করাই অসম্ভব।
 *
 * শেষ ধাপের `upToKm` সবসময় `null` — অর্থাৎ "এর পরে যত দূরই হোক"।
 * সেটা না থাকলে তালিকার বাইরের দূরত্ব মানে "আমরা ওখানে যাই না",
 * যেটাও একটা বৈধ ব্যবসায়িক নিয়ম — নিচের resolveDeliveryZone() সেই
 * দুটো ফলকে আলাদা করে ফেরত দেয়।
 */

/** settings-এ যেভাবে সংরক্ষিত হয় — owner যা লেখেন, ঠিক ততটুকু। */
export interface DeliveryZoneInput {
  /** এই ধাপ কত কিমি পর্যন্ত। শেষ ধাপে `null` = সীমাহীন। */
  upToKm: number | null;
  /** এই ধাপের ফি, রেস্তোরাঁর নিজের currency-র মূল এককে (২ মানে ২ টাকা)। */
  fee: number;
}

/** normalize করার পরের রূপ — UI আর matching দুটোতেই এটাই ব্যবহার হয়। */
export interface DeliveryZone extends DeliveryZoneInput {
  /** তালিকার মধ্যে স্থিতিশীল একটা id — React key আর snapshot মেলানোর জন্য। */
  id: string;
  /** আগের ধাপের upToKm (প্রথমটায় 0) — লেখা হয় না, বের করা হয়। */
  fromKm: number;
  /** "0–1 Km", "3–5 Km", "8+ Km" — Figma-র চিপে যা বসে। */
  label: string;
}

/**
 * Figma-র ডিফল্ট সিঁড়িটাই (0–1 $2 … 8+ $14)।
 *
 * ⚠️ এটা কেবল **প্রাথমিক মান** — নতুন database-এ settings row তৈরি
 * হওয়ার সময় বসে, আর owner /admin/settings থেকে বদলাতে পারেন। কোডের
 * কোথাও এই সংখ্যাগুলো সরাসরি পড়া হয় না, কারণ তাহলে settings-এর
 * বদলটা অর্ধেক জায়গায় লাগত আর অর্ধেকে নয়।
 */
export const DEFAULT_DELIVERY_ZONES: DeliveryZoneInput[] = [
  { upToKm: 1, fee: 2 },
  { upToKm: 3, fee: 5 },
  { upToKm: 5, fee: 7 },
  { upToKm: 8, fee: 10 },
  { upToKm: null, fee: 14 },
];

/** "3.9", "1", "8" — অকারণ দশমিক শূন্য ছাড়া। */
export function formatKm(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function zoneLabel(fromKm: number, upToKm: number | null): string {
  if (upToKm === null) return `${formatKm(fromKm)}+ Km`;
  return `${formatKm(fromKm)}–${formatKm(upToKm)} Km`;
}

/**
 * যেকোনো (সম্ভাব্য নোংরা) input থেকে একটা বৈধ সিঁড়ি।
 *
 * settings-এর column-টা `Json`, অর্থাৎ database-স্তরে কোনো আকৃতির
 * নিশ্চয়তা নেই — হাতে লেখা SQL, পুরোনো row, বা ভবিষ্যতের কোনো bug
 * যা-ই বসাক, checkout যেন কখনো crash না করে। তাই এখানে যাচাই আর
 * সংশোধন দুটোই হয়, throw নয়।
 *
 * যা করা হয়:
 *   • অচল entry বাদ (fee ঋণাত্মক/NaN, upToKm ≤ 0)
 *   • upToKm অনুযায়ী সাজানো, `null` সবসময় শেষে
 *   • একাধিক null থাকলে প্রথমটাই রাখা (দুটো "সীমাহীন" ধাপ অর্থহীন)
 *   • একই upToKm-এর ডুপ্লিকেট বাদ
 *   • কিছুই না টিকলে ডিফল্ট সিঁড়ি
 */
export function normalizeDeliveryZones(raw: unknown): DeliveryZone[] {
  const list = Array.isArray(raw) ? raw : [];

  const cleaned: DeliveryZoneInput[] = [];
  let sawOpenEnded = false;

  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const { upToKm, fee } = entry as { upToKm?: unknown; fee?: unknown };

    if (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0) continue;

    if (upToKm === null || upToKm === undefined) {
      // একটাই সীমাহীন ধাপ থাকতে পারে।
      if (sawOpenEnded) continue;
      sawOpenEnded = true;
      cleaned.push({ upToKm: null, fee });
      continue;
    }

    if (typeof upToKm !== "number" || !Number.isFinite(upToKm) || upToKm <= 0) continue;
    cleaned.push({ upToKm, fee });
  }

  const source = cleaned.length > 0 ? cleaned : DEFAULT_DELIVERY_ZONES;

  // upToKm ছোট থেকে বড়, null শেষে।
  const sorted = [...source].sort((a, b) => {
    if (a.upToKm === null) return 1;
    if (b.upToKm === null) return -1;
    return a.upToKm - b.upToKm;
  });

  const out: DeliveryZone[] = [];
  let fromKm = 0;

  for (const zone of sorted) {
    // একই সীমার দুটো ধাপ — দ্বিতীয়টা কখনো মিলতই না, তাই বাদ।
    if (zone.upToKm !== null && zone.upToKm <= fromKm && out.length > 0) continue;

    out.push({
      id: zone.upToKm === null ? "zone-open" : `zone-${formatKm(zone.upToKm)}`,
      fromKm,
      upToKm: zone.upToKm,
      fee: zone.fee,
      label: zoneLabel(fromKm, zone.upToKm),
    });

    if (zone.upToKm === null) break; // সীমাহীন ধাপের পরে আর কিছু থাকতে পারে না
    fromKm = zone.upToKm;
  }

  return out;
}

export type ZoneMatch =
  /** দূরত্বটা একটা ধাপে পড়েছে। */
  | { ok: true; zone: DeliveryZone }
  /**
   * সিঁড়ির শেষ ধাপেরও বাইরে, আর কোনো সীমাহীন ধাপ নেই।
   *
   * ⚠️ এটা ব্যর্থতা নয়, **ব্যবসায়িক সিদ্ধান্ত**: "আমরা এত দূরে
   * পৌঁছাই না।" caller-এর একে ফি-শূন্য ধরে নেওয়া চলবে না — checkout
   * থামিয়ে খদ্দেরকে বলতে হবে।
   */
  | { ok: false; reason: "OUT_OF_RANGE"; maxKm: number };

/**
 * এই দূরত্বে কোন ধাপ বসে।
 *
 * সীমাটা **উপরের দিকে অন্তর্ভুক্ত** (`distance <= upToKm`): ঠিক ১.০
 * কিমি দূরের খদ্দের "0–1 Km" ধাপেই পড়েন, পরেরটায় নয়। চিপে যা লেখা
 * আছে খদ্দের সেটাই পড়েন, আর "১ কিমি" পড়ে পরের ধাপের দাম দেখাটা
 * অন্যায্য মনে হয়।
 */
export function resolveDeliveryZone(distanceKm: number, zones: DeliveryZone[]): ZoneMatch {
  const safeDistance = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;

  for (const zone of zones) {
    if (zone.upToKm === null || safeDistance <= zone.upToKm) {
      return { ok: true, zone };
    }
  }

  const last = zones[zones.length - 1];
  return { ok: false, reason: "OUT_OF_RANGE", maxKm: last?.upToKm ?? 0 };
}

/**
 * দুটো স্থানাঙ্কের মধ্যে সরলরেখার দূরত্ব, কিলোমিটারে (haversine)।
 *
 * ⚠️ এটা **আকাশপথের** দূরত্ব, রাস্তার নয়। শহরে আসল রাস্তার দূরত্ব
 * সাধারণত ২০–৪০% বেশি হয়।
 *
 * তবু routing API (Google Distance Matrix / OSRM) ব্যবহার করা হয়নি,
 * আর সেটা ইচ্ছাকৃত:
 *
 *   • প্রতিটা checkout quote-এ একটা করে routing call মানে খরচ আর
 *     একটা billing account — অথচ পুরো map feature-টাই (Leaflet + OSM
 *     tiles + Nominatim) এখানে বিনামূল্যে চলে।
 *   • ধাপগুলো মোটা দাগের (১, ৩, ৫, ৮ কিমি)। ২০–৩০% পার্থক্যে ধাপ
 *     বদলায় কেবল সীমানার একেবারে কাছে থাকা অর্ডারে, আর সেখানে
 *     ভুলটা এক ধাপের — টাকার অঙ্কে সামান্য।
 *   • owner চাইলে ক্ষতিপূরণটা ধাপেই বসিয়ে নিতে পারেন (৩ কিমি
 *     আকাশপথ ≈ ৪ কিমি রাস্তা ধরে ধাপ ঠিক করা)।
 *
 * সত্যিকারের রাস্তার দূরত্ব দরকার হলে বদলাতে হবে কেবল
 * lib/delivery-fee.ts-এর distance হিসাবটুকু — এই file বা UI-র কিছুই
 * নয়, কারণ নিচের সবকিছু শুধু একটা সংখ্যা চায়।
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Figma-র "Distance to customer" বারটা কতটা ভরবে (০–১)।
 *
 * সীমাহীন শেষ ধাপে কোনো `upToKm` নেই, তাই বারের সর্বোচ্চ ধরা হয়
 * শেষ **সীমাবদ্ধ** ধাপের সীমা (Figma-তে ৮ কিমি)। তার চেয়ে দূরের
 * অর্ডারে বার পুরো ভরা থাকে — যা সঠিক বার্তাই দেয়: "সবচেয়ে দূরের
 * ধাপ"।
 */
export function distanceBarRatio(distanceKm: number, zones: DeliveryZone[]): number {
  const bounded = zones.filter((z) => z.upToKm !== null);
  const maxKm = bounded.length > 0 ? (bounded[bounded.length - 1].upToKm as number) : 0;
  if (maxKm <= 0) return 1;
  return Math.max(0, Math.min(1, distanceKm / maxKm));
}

/**
 * dispatch modal / checkout-এ পাঠানোর জন্য তৈরি রূপ।
 *
 * ⚠️ ফি-গুলো এখানে **সাজানো string** (`feeLabel`), কাঁচা সংখ্যা নয়।
 * currency চিহ্ন আর দশমিক সংখ্যা order-এর নিজের snapshot থেকে আসে
 * (lib/currency-format.ts-এর ব্যাখ্যা দ্রষ্টব্য), আর সেটা জানে
 * server। client component-কে সেই সিদ্ধান্তটা নিতে দিলে একই পাতায়
 * দুই রকম দশমিক দেখা যেত।
 */
export interface DeliveryZoneView {
  id: string;
  label: string;
  feeLabel: string;
  /** এই অর্ডারে যে ধাপটা আসলে বসেছিল। */
  active: boolean;
}

export interface OrderDeliverySnapshot {
  /** ধাপের তালিকা — অর্ডারের সময় যেমন ছিল, আজ যেমন নয়। */
  zones: DeliveryZoneView[];
  /** মাপা দূরত্ব, কিমি। geocode ব্যর্থ হলে `null`। */
  distanceKm: number | null;
  /** বারের সর্বোচ্চ (শেষ সীমাবদ্ধ ধাপ), লেখার জন্য। */
  barRatio: number;
  /** এই অর্ডারে সত্যিই বসা ফি — সাজানো। */
  appliedFeeLabel: string;
  /**
   * দূরত্ব মাপা যায়নি বলে flat ফি বসেছে কিনা।
   *
   * staff-কে এটা দেখানো জরুরি: চিপগুলো তখন কেবল দামের তালিকা,
   * "কেন এই ফি" তার ব্যাখ্যা নয়।
   */
  fellBackToFlat: boolean;
}
