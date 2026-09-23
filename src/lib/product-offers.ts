import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { roundMoney, toMoney, type Money, type MoneyInput } from "@/lib/money";
import { formatAmount } from "@/lib/currency-format";

/**
 * Product offers — "20% off Chic Burger until Aug 6" (/admin/offers).
 *
 * Everything that decides an offer's price or status lives here, so the
 * admin page, the menu and checkout can never disagree about it:
 *
 *   - the menu (/menu, /menu/[id], /api/menu) shows the offer price,
 *   - checkout charges it (resolveOrderItems in order-checkout-shared.ts),
 *   - the admin page shows the same numbers.
 *
 * Status is never stored; it follows from the dates (see ProductOffer in
 * schema.prisma).
 */

export type OfferStatus = "active" | "scheduled" | "ended";

export type OfferAudienceValue = "ALL" | "MEMBERS";

export type OfferPricing = {
  type: "PERCENT" | "FIXED";
  percentOff: number | null;
  fixedOff: MoneyInput | null;
};

export type OfferDates = {
  startsAt: Date;
  endsAt: Date | null;
};

export function offerStatus(offer: OfferDates, now: Date = new Date()): OfferStatus {
  if (offer.endsAt && offer.endsAt.getTime() <= now.getTime()) return "ended";
  if (offer.startsAt.getTime() > now.getTime()) return "scheduled";
  return "active";
}

/** Offers that are running right now. */
export function liveOfferWhere(now: Date = new Date()): Prisma.ProductOfferWhereInput {
  return {
    startsAt: { lte: now },
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/** Offers that have not ended yet — running or scheduled. */
export function currentOfferWhere(now: Date = new Date()): Prisma.ProductOfferWhereInput {
  return { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

/**
 * The price after the offer, rounded to the currency's minor units (a 20%
 * cut on $10.49 is $8.39, not $8.392 — the customer is charged what they
 * are shown).
 *
 * Returns null when the offer can't apply: a fixed cut as big as the price
 * (the menu price may have been lowered after the offer was made). The
 * dish then simply sells at its normal price instead of for free.
 */
export function applyOffer(
  price: MoneyInput,
  offer: OfferPricing,
  minorUnits: number
): Money | null {
  const base = toMoney(price);
  let next: Money;

  if (offer.type === "PERCENT") {
    if (offer.percentOff === null || offer.percentOff <= 0) return null;
    next = base.times(100 - offer.percentOff).dividedBy(100);
  } else {
    if (offer.fixedOff === null) return null;
    next = base.minus(toMoney(offer.fixedOff));
  }

  const rounded = roundMoney(next, minorUnits);
  if (rounded.lessThanOrEqualTo(0) || rounded.greaterThanOrEqualTo(base)) return null;
  return rounded;
}

/** "20%" or "$2.00 Off" — the pill on the dish photo. */
export function offerBadge(offer: OfferPricing, currency: string, minorUnits: number): string {
  if (offer.type === "PERCENT") return `${offer.percentOff ?? 0}%`;
  return `${formatAmount(toMoney(offer.fixedOff).toFixed(minorUnits), currency)} Off`;
}

export type LiveOffer = OfferPricing & {
  id: string;
  menuItemId: string;
  audience: OfferAudienceValue;
  startsAt: Date;
  endsAt: Date | null;
};

const LIVE_OFFER_SELECT = {
  id: true,
  menuItemId: true,
  type: true,
  percentOff: true,
  fixedOff: true,
  audience: true,
  startsAt: true,
  endsAt: true,
} as const;

/**
 * The running offer for each of these dishes, keyed by menuItemId.
 *
 * The admin API allows only one current offer per dish, so there is
 * normally one row each. If two ever overlap (e.g. rows written before
 * that rule, or by hand in the database), the newest one wins — a single,
 * predictable answer instead of whichever the database returns first.
 */
export async function findLiveOffers(
  menuItemIds: string[],
  now: Date = new Date()
): Promise<Map<string, LiveOffer>> {
  const result = new Map<string, LiveOffer>();
  if (menuItemIds.length === 0) return result;

  const rows = await prisma.productOffer.findMany({
    where: { menuItemId: { in: menuItemIds }, ...liveOfferWhere(now) },
    orderBy: { createdAt: "desc" },
    select: LIVE_OFFER_SELECT,
  });

  for (const row of rows) {
    if (!result.has(row.menuItemId)) result.set(row.menuItemId, row);
  }
  return result;
}

/**
 * What one dish costs this customer right now.
 *
 *   price          what they pay
 *   originalPrice  the menu price, when an offer lowered it (else null)
 *   offer          the offer that applies to them (else null)
 *   memberOffer    a members-only offer a guest is missing out on — the
 *                  menu can say "20% off for members" without charging it
 */
export type EffectivePrice = {
  price: Money;
  originalPrice: Money | null;
  offer: LiveOffer | null;
  memberOffer: LiveOffer | null;
};

export function effectivePrice(
  menuPrice: MoneyInput,
  offer: LiveOffer | undefined,
  isMember: boolean,
  minorUnits: number
): EffectivePrice {
  const base = toMoney(menuPrice);
  const none: EffectivePrice = { price: base, originalPrice: null, offer: null, memberOffer: null };
  if (!offer) return none;

  const discounted = applyOffer(base, offer, minorUnits);
  if (!discounted) return none;

  if (offer.audience === "MEMBERS" && !isMember) {
    return { ...none, memberOffer: offer };
  }
  return { price: discounted, originalPrice: base, offer, memberOffer: null };
}

// ── Dates ──────────────────────────────────────────────────────────────────

/**
 * Midnight at the start of `isoDate` ("2026-08-06") in the restaurant's
 * time zone, as a real instant.
 *
 * ⚠️ Not `new Date("2026-08-06")` — that is midnight UTC, which in Dhaka
 * is 6 AM. An offer set to start on the 1st would then only begin at 6 AM,
 * and one set to end on the 6th would run until 6 AM on the 7th.
 */
export function zonedDayStart(isoDate: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  // How far the zone is from UTC at that moment (DST-safe: measured there).
  const offset = zoneOffsetMs(new Date(utcGuess), timeZone);
  const first = new Date(utcGuess - offset);
  // Re-measure once in case the offset changes across that midnight.
  const offset2 = zoneOffsetMs(first, timeZone);
  return offset2 === offset ? first : new Date(utcGuess - offset2);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-08-06" for an instant, in the restaurant's time zone. */
export function zonedISODate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The day after `isoDate` — "2026-08-31" → "2026-09-01". */
export function nextISODate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * The last day an offer runs, for "Ends Aug 6, 2026". endsAt is exclusive
 * (midnight after the last day), so step back one millisecond first.
 */
export function lastOfferDay(endsAt: Date): Date {
  return new Date(endsAt.getTime() - 1);
}

/**
 * Everything a menu card needs about one dish's price, for the customer
 * looking at it:
 *
 *   price / priceLabel   what they would pay (offer price if it applies)
 *   oldPriceLabel        the struck-through menu price, when discounted
 *   badge                the pill on the photo — "20%", "$2.00 Off", or
 *                        "20% Members" for a guest looking at a
 *                        members-only offer (they see the full price)
 */
export type DisplayPrice = {
  price: number;
  priceLabel: string;
  oldPriceLabel: string | null;
  badge: string | null;
};

export function displayPrice(
  menuPrice: MoneyInput,
  offer: LiveOffer | undefined,
  isMember: boolean,
  currency: string,
  minorUnits: number
): DisplayPrice {
  const result = effectivePrice(menuPrice, offer, isMember, minorUnits);
  const label = (value: Money) => formatAmount(value.toFixed(minorUnits), currency);

  let badge: string | null = null;
  if (result.offer) badge = offerBadge(result.offer, currency, minorUnits);
  else if (result.memberOffer) badge = `${offerBadge(result.memberOffer, currency, minorUnits)} Members`;

  return {
    price: result.price.toNumber(),
    priceLabel: label(result.price),
    oldPriceLabel: result.originalPrice ? label(result.originalPrice) : null,
    badge,
  };
}
