import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Plus,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { getLoyaltyTiers } from "@/lib/loyalty-config";
import { formatAmount } from "@/lib/currency-format";
import { formatOrderId } from "@/lib/format-order-id";
import { orderStatusLabel } from "@/lib/order-status-filter";
import { displayPrice, findLiveOffers } from "@/lib/product-offers";
import { ACTIVE_ORDER_STATUSES, pageList, targetProgress, topDishes } from "@/lib/account";
import LiveOrderCard from "@/components/account/LiveOrderCard";
import AddDishButton from "@/components/account/AddDishButton";
import { CARD, CARD_TITLE, PRIMARY_BUTTON, STATUS_PILL } from "@/components/account/ui";

export const metadata: Metadata = { title: "My Orders" };

/**
 * src/app/(main)/account/page.tsx — customer panel → My Orders.
 *
 * Figma "Web/My Account":
 *   1. Target Progress — points toward the next loyalty level, on the
 *      striped bar, with what reaching it unlocks.
 *   2. Total Orders — three cream stat boxes.
 *   3. Order History — cream rows (order id, date · dishes, price, status
 *      pill), 5 per page with Figma's page buttons.
 *
 * Kept from the earlier panel because food apps put them here too:
 *   • "Happening now" (above everything, only while an order is on its
 *     way) — live progress + Track.
 *   • "Your favourites" with a one-tap Add.
 *
 * Order History rows follow Figma exactly — no "Order again" button; the
 * whole row opens the order.
 *
 * Every query is scoped to the signed-in customer's own id.
 */

const PAGE_SIZE = 5;

function PageButton({ href, active, children, label }: { href?: string; active?: boolean; children: React.ReactNode; label?: string }) {
  const base =
    "flex h-[34px] min-w-[34px] items-center justify-center rounded-[8px] border px-2 font-sora text-[12px] leading-none transition-colors";
  if (!href) {
    return (
      <span className={`${base} border-black/10 text-black/30`} aria-hidden="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={`${base} ${active ? "border-black bg-black text-white" : "border-black/20 text-black/70 hover:border-black hover:text-black"}`}
    >
      {children}
    </Link>
  );
}

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");
  const userId = session.user.id;
  const now = new Date();

  const [user, settings, tiers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true, notifyRecommendations: true } }),
    getRestaurantSettings(),
    getLoyaltyTiers(),
  ]);
  const { timezone, currency, currencyMinorUnits } = settings;

  // Server clock runs on the restaurant's time zone (get-settings), so
  // these are the restaurant's calendar months.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const totalOrders = await prisma.order.count({ where: { userId } });
  const pageCount = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const page = Math.min(Math.max(parseInt(params.page ?? "1", 10) || 1, 1), pageCount);

  const [activeOrders, history, placedCount, deliveredCount, thisMonth, lastMonth, earned, orderedLines] =
    await Promise.all([
      prisma.order.findMany({
        where: { userId, status: { in: ACTIVE_ORDER_STATUSES } },
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
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
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
      prisma.order.count({ where: { userId, status: { not: "CANCELLED" } } }),
      prisma.order.count({ where: { userId, status: "DELIVERED" } }),
      prisma.order.count({ where: { userId, status: { not: "CANCELLED" }, createdAt: { gte: monthStart } } }),
      prisma.order.count({
        where: { userId, status: { not: "CANCELLED" }, createdAt: { gte: lastMonthStart, lt: monthStart } },
      }),
      prisma.loyaltyTransaction.aggregate({ where: { userId, points: { gt: 0 } }, _sum: { points: true } }),
      prisma.orderItem.findMany({
        where: { order: { userId } },
        orderBy: { order: { createdAt: "desc" } },
        take: 300,
        select: { menuItemId: true, quantity: true, order: { select: { createdAt: true, status: true } } },
      }),
    ]);

  // ── Favourites ──────────────────────────────────────────────────────
  // Hidden when "Product Recommendations" is off (Profile Details).
  const showFavourites = user?.notifyRecommendations ?? true;
  const favouriteIds = !showFavourites ? [] : topDishes(
    orderedLines.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      orderedAt: line.order.createdAt,
      orderStatus: line.order.status,
    })),
    8
  );
  const favouriteItems = favouriteIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: favouriteIds.map((f) => f.menuItemId) }, isAvailable: true },
        select: { id: true, title: true, description: true, price: true, imageUrl: true },
      })
    : [];
  const offers = favouriteItems.length ? await findLiveOffers(favouriteItems.map((item) => item.id), now) : new Map();
  const favourites = favouriteIds
    .map(({ menuItemId, timesOrdered }) => {
      const item = favouriteItems.find((candidate) => candidate.id === menuItemId);
      if (!item) return null;
      return { ...item, timesOrdered, shown: displayPrice(item.price, offers.get(item.id), true, currency, currencyMinorUnits) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 4);

  // ── Labels ──────────────────────────────────────────────────────────
  const points = user?.loyaltyPoints ?? 0;
  const target = targetProgress(points, tiers);
  const pointsEarned = earned._sum.points ?? 0;

  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: timezone });
  const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const money = (value: { toFixed(n: number): string }, units: number, code: string) => formatAmount(value.toFixed(units), code);
  const dishesLabel = (items: { quantity: number; menuItem: { title: string } }[]) =>
    items.map((line) => (line.quantity > 1 ? `${line.menuItem.title} ×${line.quantity}` : line.menuItem.title)).join(", ");

  const monthDiff = thisMonth - lastMonth;
  const stats = [
    {
      label: "Total Orders",
      value: placedCount.toLocaleString("en-US"),
      chip: `${deliveredCount.toLocaleString("en-US")} delivered`,
      icon: ShoppingBag,
    },
    {
      label: "This Month",
      value: thisMonth.toLocaleString("en-US"),
      chip: monthDiff === 0 ? "Same as last month" : `${monthDiff > 0 ? "+" : ""}${monthDiff} vs last month`,
      icon: Receipt,
    },
    {
      label: "Points Earned",
      value: pointsEarned.toLocaleString("en-US"),
      chip: `${points.toLocaleString("en-US")} available now`,
      icon: Coins,
    },
  ];

  const from = totalOrders === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalOrders);
  const pageHref = (p: number) => (p <= 1 ? "/account#order-history" : `/account?page=${p}#order-history`);

  return (
    <>
      {/* Happening now — only while an order is on its way */}
      {activeOrders.length > 0 && (
        <section aria-labelledby="live-orders" className={`${CARD} flex flex-col gap-5`}>
          <div>
            <h2 id="live-orders" className={CARD_TITLE}>
              Happening Now
            </h2>
            <p className="mt-2 font-sora text-[14px] text-black/70">We&apos;ll keep this updated until your order arrives.</p>
          </div>
          <div className="grid gap-4 2xl:grid-cols-2">
            {activeOrders.map((order) => (
              <LiveOrderCard
                key={order.id}
                order={{
                  id: order.id,
                  reference: formatOrderId(order.id),
                  status: order.status,
                  orderType: order.orderType,
                  placedLabel: dateTimeFmt.format(order.createdAt),
                  itemsLabel: order.items.map((line) => `${line.quantity}× ${line.menuItem.title}`).join(", "),
                  totalLabel: money(order.totalAmount, order.currencyMinorUnits, order.currency),
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Figma: Target Progress */}
      <section aria-labelledby="target-progress" className={`${CARD} flex flex-col gap-6`}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="target-progress" className={CARD_TITLE}>
            Target Progress
          </h2>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F9F6F3]">
            <Flag className="h-[18px] w-[18px] text-black" strokeWidth={1.5} aria-hidden="true" />
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="font-frank-ruhl text-[22px] font-semibold leading-none text-black md:text-[24px]">
              {points.toLocaleString("en-US")}
              {target.target !== null ? (
                <span className="text-black/40"> / {target.target.toLocaleString("en-US")} points</span>
              ) : (
                <span className="text-black/40"> points</span>
              )}
            </p>
            {/* Figma: 26px cream track with white diagonal stripes, #FF9540 fill. */}
            <div
              className="h-[26px] w-full overflow-hidden rounded-full bg-[repeating-linear-gradient(115deg,#F9F6F3_0px,#F9F6F3_10px,#FFFFFF_10px,#FFFFFF_12px)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={target.percent}
              aria-label={target.nextLabel ? `Progress to ${target.nextLabel}` : "Top level reached"}
            >
              <div className="h-full rounded-full bg-[#FF9540]" style={{ width: `${Math.max(target.percent, 4)}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 font-sora text-[14px] leading-[1.3] md:text-[16px]">
            <span className="text-black">{target.percent}% Complete</span>
            <span className="text-black/70">
              {target.nextLabel ? (
                <>
                  Reach <strong className="font-semibold text-black">{target.nextLabel}</strong>
                  {target.reward ? <> and get <strong className="font-semibold text-black">{target.reward}</strong></> : null}
                </>
              ) : (
                "You've reached our top level — enjoy every perk!"
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Figma: Total Orders */}
      <section aria-labelledby="total-orders" className={`${CARD} flex flex-col gap-5`}>
        <h2 id="total-orders" className={CARD_TITLE}>
          Total Orders
        </h2>
        <ul className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-3 xl:gap-5">
          {stats.map(({ label, value, chip, icon: Icon }) => (
            <li key={label} className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-[1.1] text-black xl:text-[20px]">
                  {label}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <Icon className="h-[18px] w-[18px] text-black" strokeWidth={1.5} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">{value}</span>
                <span className="self-start rounded-full bg-white/80 px-2.5 py-1.5 font-sora text-[12px] leading-none text-black/70">
                  {chip}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Figma: Order History */}
      <section id="order-history" aria-labelledby="order-history-title" className={`${CARD} flex scroll-mt-6 flex-col gap-5`}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="order-history-title" className={CARD_TITLE}>
            Order History
          </h2>
          <span className="shrink-0 font-sora text-[15px] leading-[1.14] text-black/70 md:text-[18px]">
            {totalOrders.toLocaleString("en-US")} {totalOrders === 1 ? "Order" : "Orders"}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[20px] bg-[#F9F6F3] px-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
              <UtensilsCrossed className="h-6 w-6 text-black/60" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <p className="font-frank-ruhl text-[22px] font-semibold text-black">No orders yet</p>
              <p className="mt-1 font-sora text-[14px] text-black/70">Your first meal is a few taps away.</p>
            </div>
            <Link href="/menu" className={PRIMARY_BUTTON}>
              Browse the menu
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {history.map((order) => {
              return (
                <li
                  key={order.id}
                  className="relative flex flex-col gap-4 rounded-[20px] bg-[#F9F6F3] px-5 py-5 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] md:flex-row md:items-center md:justify-between md:px-[30px]"
                >
                  <div className="flex min-w-0 flex-col gap-2.5">
                    {/* The whole row opens the order (receipt + tracking). */}
                    <Link
                      href={`/track/${order.id}`}
                      className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black after:absolute after:inset-0 after:rounded-[20px] focus:outline-none focus-visible:after:[outline:2px_solid_#FF9540] md:text-[24px]"
                    >
                      {formatOrderId(order.id)}
                    </Link>
                    <p className="line-clamp-2 font-sora text-[14px] leading-[1.3] text-black/70 md:text-[16px]">
                      {dateFmt.format(order.createdAt)} · {dishesLabel(order.items)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3 md:gap-5">
                    <span className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] text-black">
                      {money(order.totalAmount, order.currencyMinorUnits, order.currency)}
                    </span>
                    <span
                      className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-[90px] px-4 font-sora text-[14px] font-semibold leading-none md:h-[46px] md:px-5 md:text-[16px] ${
                        STATUS_PILL[order.status] ?? "bg-white text-black"
                      }`}
                    >
                      {orderStatusLabel(order.status, order.orderType)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalOrders > 0 && (
          <nav aria-label="Order pages" className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 px-2.5 font-sora text-[12px] leading-[15px] text-black/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF9540]" aria-hidden="true" />
              Showing <strong className="font-semibold text-black">{from}-{to}</strong> of {totalOrders} Orders
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2 md:gap-3">
                <PageButton href={page > 1 ? pageHref(page - 1) : undefined} label="Previous page">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </PageButton>
                {pageList(page, pageCount).map((p, index) =>
                  p === null ? (
                    <PageButton key={`gap-${index}`}>…</PageButton>
                  ) : (
                    <PageButton key={p} href={pageHref(p)} active={p === page} label={`Page ${p}`}>
                      {p}
                    </PageButton>
                  )
                )}
                <PageButton href={page < pageCount ? pageHref(page + 1) : undefined} label="Next page">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </PageButton>
              </div>
            )}
          </nav>
        )}
      </section>

      {/* Your favourites — one tap back into the cart */}
      {favourites.length > 0 && (
        <section aria-labelledby="favourites" className={`${CARD} flex flex-col gap-5`}>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 id="favourites" className={CARD_TITLE}>
                Your Favourites
              </h2>
              <p className="mt-2 font-sora text-[14px] text-black/70">The dishes you order most.</p>
            </div>
            <Link href="/menu" className="flex shrink-0 items-center gap-1 font-sora text-[14px] font-semibold text-black hover:underline">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Full menu
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
            {favourites.map((dish) => (
              <li key={dish.id} className="flex min-w-0 gap-3 rounded-[20px] bg-[#F9F6F3] p-3">
                <Link href={`/menu/${dish.id}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-white">
                  {dish.imageUrl ? (
                    <Image src={dish.imageUrl} alt={dish.title} fill sizes="80px" className="object-cover" />
                  ) : (
                    <UtensilsCrossed className="absolute inset-0 m-auto h-6 w-6 text-black/30" aria-hidden="true" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/menu/${dish.id}`}
                      className="line-clamp-1 font-frank-ruhl text-[18px] font-semibold leading-tight text-black hover:underline"
                    >
                      {dish.title}
                    </Link>
                    <p className="mt-0.5 font-sora text-[12px] text-black/60">
                      Ordered {dish.timesOrdered} {dish.timesOrdered === 1 ? "time" : "times"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-frank-ruhl text-[18px] font-semibold text-black">
                      {dish.shown.priceLabel}
                      {dish.shown.oldPriceLabel && (
                        <span className="ml-1 font-sora text-[12px] font-normal text-black/40 line-through">
                          {dish.shown.oldPriceLabel}
                        </span>
                      )}
                    </span>
                    <AddDishButton
                      dish={{ id: dish.id, title: dish.title, price: dish.shown.price, imageUrl: dish.imageUrl, description: dish.description }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
