import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import { displayPrice, findLiveOffers } from "@/lib/product-offers";
import { liveCouponWhere } from "@/lib/coupon-filters";
import { normalizeDeliveryZones } from "@/lib/delivery-zones";
import { formatOrderId } from "@/lib/format-order-id";
import { orderStatusLabel } from "@/lib/order-status-filter";
import { formatSpend, getTierProgress, tierPerks } from "@/lib/loyalty-tiers";
import { earnRuleSentence, getActiveEarnRule, getLoyaltyTiers } from "@/lib/loyalty-config";
import { MIN_REDEEMABLE_POINTS, POINTS_TO_DOLLAR_RATE } from "@/lib/loyalty-redemption";
import type { AssistantContext, AssistantDish } from "./core";

/**
 * src/lib/ai-assistant/context.ts
 *
 * Collects the facts the assistant is allowed to use — live menu with the
 * price this customer would actually pay, ratings, what's popular, coupon
 * codes, opening hours, delivery fees, and (signed in only) their own
 * points and recent orders. Nothing about any other customer.
 *
 * The shared part (menu, coupons, hours) is cached for 60 seconds per
 * price view (guest / member), so a busy evening doesn't turn every chat
 * message into a dozen queries. A price or menu change shows up within a
 * minute; checkout always re-prices from the database anyway.
 */

type Shared = Omit<AssistantContext, "user" | "cart">;

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Shared }>();

const HOUR_LABEL = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
};

function hourIn(timezone: string, now: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(now),
    10
  );
}

/** Same rule as the site's top bar: open from the opening hour until the closing hour. */
export function isKitchenOpen(settings: { timezone: string; kitchenOpenHour: number; kitchenCloseHour: number }, now = new Date()): boolean {
  const hour = hourIn(settings.timezone, now);
  const { kitchenOpenHour: open, kitchenCloseHour: close } = settings;
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}

async function buildShared(isMember: boolean): Promise<Shared> {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const settings = await getRestaurantSettings();
  const { currency, currencyMinorUnits: units, timezone } = settings;
  const money = (value: { toFixed(n: number): string } | number) =>
    formatAmount(typeof value === "number" ? value.toFixed(units) : value.toFixed(units), currency);

  const items = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      foodStatus: true,
      ingredientTags: true,
      calories: true,
      proteinGrams: true,
      prepTimeMinutes: true,
      category: { select: { name: true } },
    },
  });
  const ids = items.map((item) => item.id);

  const [offers, ratings, sold, coupons] = await Promise.all([
    findLiveOffers(ids, now),
    prisma.review.groupBy({
      by: ["menuItemId"],
      where: { status: "APPROVED", menuItemId: { in: ids } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { in: ids },
        order: { createdAt: { gte: monthAgo }, status: { not: "CANCELLED" } },
      },
      _sum: { quantity: true },
    }),
    prisma.coupon.findMany({
      where: liveCouponWhere(now),
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        code: true,
        headline: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        minOrderValue: true,
        maxDiscountAmount: true,
        usageLimit: true,
        usageCount: true,
        expiresAt: true,
        audience: true,
        restrictedCategories: { select: { name: true } },
      },
    }),
  ]);

  const ratingBy = new Map(ratings.map((r) => [r.menuItemId, { avg: r._avg.rating, count: r._count._all }]));
  const soldBy = new Map(sold.map((s) => [s.menuItemId, s._sum.quantity ?? 0]));

  const dishes: AssistantDish[] = items.map((item) => {
    const shown = displayPrice(item.price, offers.get(item.id), isMember, currency, units);
    const rating = ratingBy.get(item.id);
    return {
      id: item.id,
      title: item.title,
      category: item.category.name,
      description: item.description,
      price: shown.price,
      priceLabel: shown.priceLabel,
      oldPriceLabel: shown.oldPriceLabel,
      badge: shown.badge,
      imageUrl: item.imageUrl,
      foodStatus: item.foodStatus,
      tags: item.ingredientTags,
      calories: item.calories,
      proteinGrams: item.proteinGrams,
      prepTimeMinutes: item.prepTimeMinutes,
      rating: rating?.avg ?? null,
      reviewCount: rating?.count ?? 0,
      soldRecently: soldBy.get(item.id) ?? 0,
    };
  });

  const dateLabel = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: timezone });

  const couponLines = coupons
    .filter((c) => c.usageLimit === null || c.usageCount < c.usageLimit)
    .map((c) => {
      const what =
        c.type === "FREE_DELIVERY"
          ? "free delivery (delivery orders only)"
          : c.type === "PERCENT"
            ? `${c.percentOff}% off${c.maxDiscountAmount ? ` (up to ${money(c.maxDiscountAmount)})` : ""}`
            : `${c.fixedOff ? money(c.fixedOff) : ""} off`;
      const conditions = [
        c.minOrderValue ? `orders over ${money(c.minOrderValue)}` : null,
        c.restrictedCategories.length ? `only on ${c.restrictedCategories.map((r) => r.name).join(", ")}` : null,
        c.audience === "NEW_CUSTOMERS" ? "first order only" : c.audience === "MEMBERS" ? "signed-in members only" : null,
        c.expiresAt ? `until ${dateLabel(new Date(c.expiresAt.getTime() - 1))}` : null,
      ].filter(Boolean);
      return `${c.code} — ${c.headline ? `${c.headline}: ` : ""}${what}${conditions.length ? ` (${conditions.join(", ")})` : ""}`;
    });

  const zones = normalizeDeliveryZones(settings.deliveryZones);
  const deliveryLabel =
    settings.deliveryFeeMode === "DISTANCE"
      ? `fee by distance — ${zones.map((z) => `${z.label}: ${money(z.fee)}`).join(", ")}` +
        (zones.length && zones[zones.length - 1].upToKm !== null
          ? `; no delivery beyond ${zones[zones.length - 1].upToKm} km`
          : "") +
        ". Dine-in and table orders have no delivery fee."
      : `flat fee ${money(settings.deliveryFeeFlat)}. Dine-in and table orders have no delivery fee.`;

  return {
    currency,
    nowLabel: now.toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }),
    kitchenOpen: isKitchenOpen(settings, now),
    hoursLabel: `${HOUR_LABEL(settings.kitchenOpenHour)} – ${HOUR_LABEL(settings.kitchenCloseHour)} every day`,
    deliveryLabel,
    dishes,
    coupons: couponLines,
  };
}

async function sharedContext(isMember: boolean): Promise<Shared> {
  const key = isMember ? "member" : "guest";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await buildShared(isMember);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function userContext(userId: string): Promise<AssistantContext["user"]> {
  const [user, tiers, earnRule, settings, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, loyaltyPoints: true } }),
    getLoyaltyTiers(),
    getActiveEarnRule(),
    getRestaurantSettings(),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        status: true,
        orderType: true,
        createdAt: true,
        totalAmount: true,
        currency: true,
        currencyMinorUnits: true,
        items: { select: { quantity: true, menuItem: { select: { title: true } } } },
      },
    }),
  ]);
  if (!user) return null;

  const progress = getTierProgress(user.loyaltyPoints, tiers);
  const earnText = earnRule ? earnRuleSentence(earnRule, settings.currency) : null;
  const pointsPerUnit = Math.round(1 / POINTS_TO_DOLLAR_RATE);

  return {
    firstName: (user.name ?? "there").split(" ")[0],
    points: user.loyaltyPoints,
    tier: progress.tier.label,
    nextTier: progress.nextTier?.label ?? null,
    pointsToNextTier: progress.pointsToNextTier,
    tierPerks: tierPerks(progress.tier, null).join(", "),
    earnRule: earnText,
    redeemRule: `${pointsPerUnit} points = ${formatSpend(1, settings.currency)} off at checkout, from ${MIN_REDEEMABLE_POINTS} points`,
    orders: orders.map((order) => ({
      label: formatOrderId(order.id),
      status: orderStatusLabel(order.status, order.orderType),
      placedAt: order.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: settings.timezone,
      }),
      items: order.items
        .slice(0, 4)
        .map((line) => `${line.quantity}× ${line.menuItem.title}`)
        .join(", "),
      total: formatAmount(order.totalAmount.toFixed(order.currencyMinorUnits), order.currency),
      href: `/track/${order.id}`,
    })),
  };
}

/**
 * Everything the assistant may use for this request. `cart` comes from the
 * browser, so only ids that are really on the menu are kept (and titles
 * come from the menu, not from the browser).
 */
export async function getAssistantContext(
  userId: string | null,
  cart: { id: string; quantity: number }[]
): Promise<AssistantContext> {
  const [shared, user] = await Promise.all([
    sharedContext(Boolean(userId)),
    userId ? userContext(userId) : Promise.resolve(null),
  ]);
  const titleBy = new Map(shared.dishes.map((dish) => [dish.id, dish.title]));
  return {
    ...shared,
    user,
    cart: cart
      .filter((line) => titleBy.has(line.id))
      .slice(0, 20)
      .map((line) => ({ title: titleBy.get(line.id) as string, quantity: line.quantity })),
  };
}
