import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { getRestaurantSettings } from "@/lib/get-settings";
import type { OfferInput } from "@/lib/validations/offer";
import { formatAmount } from "@/lib/currency-format";
import {
  applyOffer,
  currentOfferWhere,
  lastOfferDay,
  liveOfferWhere,
  nextISODate,
  zonedDayStart,
  zonedISODate,
} from "@/lib/product-offers";

/**
 * The checks and date maths shared by "create" (POST /api/admin/offers)
 * and "edit" (PATCH /api/admin/offers/[id]).
 *
 * Returns the row data to write, or the message + status to send back.
 */
export async function buildOfferData(
  input: OfferInput,
  existing: { id: string; startsAt: Date } | null
): Promise<
  | { ok: true; data: Omit<Prisma.ProductOfferUncheckedCreateInput, "id"> }
  | { ok: false; status: number; error: string }
> {
  const settings = await getRestaurantSettings();
  const tz = settings.timezone;
  const now = new Date();
  const today = zonedISODate(now, tz);

  const item = await prisma.menuItem.findUnique({
    where: { id: input.menuItemId },
    select: { id: true, title: true, price: true },
  });
  if (!item) return { ok: false, status: 404, error: "That product no longer exists." };

  // ── Discount ───────────────────────────────────────────────────────────
  const pricing =
    input.type === "PERCENT"
      ? { type: "PERCENT" as const, percentOff: input.value, fixedOff: null }
      : { type: "FIXED" as const, percentOff: null, fixedOff: toMoney(input.value) };

  if (!applyOffer(item.price, pricing, settings.currencyMinorUnits)) {
    return {
      ok: false,
      status: 400,
      error: `The discount must leave ${item.title} with a price above zero.`,
    };
  }

  // ── Dates ──────────────────────────────────────────────────────────────
  // A new offer can't start in the past. When editing, the start date it
  // already had is kept as it is (a running offer started days ago).
  const keptStart = existing && zonedISODate(existing.startsAt, tz) === input.startDate;
  if (!keptStart && input.startDate < today) {
    return { ok: false, status: 400, error: "Start date can't be in the past." };
  }
  if (input.endDate && input.endDate < today) {
    return { ok: false, status: 400, error: "Expiry date can't be in the past." };
  }

  const startsAt = keptStart ? existing!.startsAt : zonedDayStart(input.startDate, tz);
  // Exclusive end: midnight after the last day.
  const endsAt = input.endDate ? zonedDayStart(nextISODate(input.endDate), tz) : null;

  // ── One current offer per dish ─────────────────────────────────────────
  // Two offers on the same dish would leave the price to chance.
  const clash = await prisma.productOffer.findFirst({
    where: {
      menuItemId: item.id,
      ...(existing ? { id: { not: existing.id } } : {}),
      ...currentOfferWhere(now),
    },
    select: { endsAt: true },
  });
  if (clash) {
    const until = clash.endsAt
      ? ` (runs until ${lastOfferDay(clash.endsAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: tz,
        })})`
      : "";
    return {
      ok: false,
      status: 409,
      error: `${item.title} already has an offer${until}. Edit or remove that one first.`,
    };
  }

  return {
    ok: true,
    data: {
      menuItemId: item.id,
      ...pricing,
      audience: input.audience,
      startsAt,
      endsAt,
    },
  };
}

export type OfferStats = {
  /** Orders that bought the dish at the offer price (cancelled ones left out). */
  orders: number;
  /** Units sold at the offer price. */
  units: number;
  /** How much customers saved in total: (normal − offer price) × units. */
  savings: Prisma.Decimal;
};

/**
 * Order numbers for each offer, keyed by offer id — "84 orders" on the
 * offer cards and the columns in the CSV export.
 */
export async function offerOrderStats(offerIds: string[]): Promise<Map<string, OfferStats>> {
  const stats = new Map<string, OfferStats>();
  if (offerIds.length === 0) return stats;

  const lines = await prisma.orderItem.findMany({
    where: { offerId: { in: offerIds }, order: { status: { not: "CANCELLED" } } },
    select: { offerId: true, orderId: true, quantity: true, price: true, originalPrice: true },
  });

  const ordersSeen = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!line.offerId) continue;
    const entry = stats.get(line.offerId) ?? { orders: 0, units: 0, savings: toMoney(0) };
    entry.units += line.quantity;
    if (line.originalPrice) {
      entry.savings = entry.savings.plus(line.originalPrice.minus(line.price).times(line.quantity));
    }
    const seen = ordersSeen.get(line.offerId) ?? new Set<string>();
    seen.add(line.orderId);
    ordersSeen.set(line.offerId, seen);
    entry.orders = seen.size;
    stats.set(line.offerId, entry);
  }
  return stats;
}

/**
 * A running product offer, ready to show as a card in the subscriber email
 * (/admin/marketing). Null when the offer doesn't exist or isn't running
 * any more — an email must never advertise a price the menu won't charge.
 */
export async function featuredOfferForEmail(offerId: string): Promise<{
  menuItemId: string;
  card: {
    title: string;
    imageUrl: string | null;
    badge: string;
    oldPrice: string;
    newPrice: string;
    note: string;
  };
} | null> {
  const now = new Date();
  const offer = await prisma.productOffer.findFirst({
    where: { id: offerId, ...liveOfferWhere(now) },
    select: {
      type: true,
      percentOff: true,
      fixedOff: true,
      audience: true,
      endsAt: true,
      menuItem: { select: { id: true, title: true, price: true, imageUrl: true } },
    },
  });
  if (!offer) return null;

  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const newPrice = applyOffer(offer.menuItem.price, offer, units);
  if (!newPrice) return null;

  const money = (value: Prisma.Decimal) => formatAmount(value.toFixed(units), settings.currency);
  const ends = offer.endsAt
    ? `Ends ${lastOfferDay(offer.endsAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: settings.timezone,
      })}`
    : "Limited time";

  return {
    menuItemId: offer.menuItem.id,
    card: {
      title: offer.menuItem.title,
      // Email clients need a full https address; anything else is left out.
      imageUrl: offer.menuItem.imageUrl?.startsWith("https://") ? offer.menuItem.imageUrl : null,
      badge: offer.type === "PERCENT" ? `${offer.percentOff}% Off` : `${money(toMoney(offer.fixedOff))} Off`,
      oldPrice: money(offer.menuItem.price),
      newPrice: money(newPrice),
      note: offer.audience === "MEMBERS" ? `${ends} · Members only — sign in to get it` : ends,
    },
  };
}
