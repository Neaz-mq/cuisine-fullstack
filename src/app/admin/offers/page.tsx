import Image from "next/image";
import Link from "next/link";
import { BadgePercent, Calendar, Mail, ShoppingBag, TicketX, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import {
  DASHBOARD_PERIODS,
  PERIOD_LABELS,
  isDashboardPeriod,
  periodStart,
  type DashboardPeriod,
} from "@/lib/dashboard-period";
import {
  DEFAULT_OFFER_STATUS,
  OFFER_LIST_TITLES,
  isOfferStatusFilter,
  offerListWhere,
  type OfferStatusFilter,
} from "@/lib/offer-filters";
import {
  applyOffer,
  currentOfferWhere,
  lastOfferDay,
  liveOfferWhere,
  offerBadge,
  offerStatus,
  zonedISODate,
} from "@/lib/product-offers";
import { offerOrderStats } from "@/lib/offer-admin";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "../orders/Pagination";
import OffersToolbar from "./OffersToolbar";
import UrlFilterMenu from "./UrlFilterMenu";
import OfferCardActions from "./OfferCardActions";
import AddOfferButton from "./AddOfferButton";
import type { EditableOffer, MoneyFormat, OfferProduct } from "./types";

export const metadata = { title: "Offers" };

/**
 * /admin/offers — built to the Figma "Offers" frame (1059 wide, column,
 * gap 24):
 *
 *   Welcome header · date pill · Export Report
 *   Search by Item name + All Statuses + Create Offer
 *   Overview (3 tiles, own period: ?overview=)
 *   Active Product Offers (cards, category: ?cat=, 6 per page: ?page=)
 *   Add an Offer to a Product (rows, category: ?addCat=, 5 per page: ?addPage=)
 *
 * An offer is a price cut on one dish for a time window. The menu shows
 * the lower price and checkout charges it — see ProductOffer in
 * schema.prisma and src/lib/product-offers.ts.
 *
 * Same card, title and tile styles as the Reviews and Insights pages.
 */

const OFFERS_PAGE_SIZE = 6;
const ADD_PAGE_SIZE = 5;
const ENDING_SOON_DAYS = 3;

const CARD = "flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";

const PERIOD_OPTIONS = DASHBOARD_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }));

// Hint under "Orders Offer" for each period.
const PERIOD_HINTS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  all: "All time",
};

type SearchParams = {
  q?: string;
  status?: string;
  overview?: string;
  cat?: string;
  addCat?: string;
  page?: string;
  addPage?: string;
};

function readPage(value: string | undefined) {
  return Math.max(1, parseInt(value ?? "1", 10) || 1);
}

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireStaff("marketing");
  const params = await searchParams;

  const q = params.q?.trim() || undefined;
  const status: OfferStatusFilter = isOfferStatusFilter(params.status)
    ? params.status
    : DEFAULT_OFFER_STATUS;
  // Figma's pill reads "All Over" — the whole history by default.
  const overviewPeriod: DashboardPeriod = isDashboardPeriod(params.overview)
    ? params.overview
    : "all";

  const now = new Date();
  const settings = await getRestaurantSettings();
  const tz = settings.timezone;
  const units = settings.currencyMinorUnits;
  const money: MoneyFormat = { currency: settings.currency, minorUnits: units };
  const label = (value: { toFixed(digits: number): string } | number) =>
    formatAmount(
      typeof value === "number" ? value.toFixed(units) : value.toFixed(units),
      settings.currency
    );
  const day = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const categoryIds = new Set(categories.map((c) => c.id));
  const cat = params.cat && categoryIds.has(params.cat) ? params.cat : "all";
  const addCat = params.addCat && categoryIds.has(params.addCat) ? params.addCat : "all";
  const categoryOptions = [
    { value: "all", label: "All" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  // ── Overview ────────────────────────────────────────────────────────────
  const overviewSince = periodStart(overviewPeriod, now);
  const soon = new Date(now.getTime() + ENDING_SOON_DAYS * 24 * 60 * 60 * 1000);

  // ── Offer cards ─────────────────────────────────────────────────────────
  const offerWhere = offerListWhere(
    { q, status, categoryId: cat === "all" ? undefined : cat },
    now
  );

  // ── "Add an Offer" rows: dishes on the menu with no current offer ───────
  const addWhere = {
    isAvailable: true,
    offers: { none: currentOfferWhere(now) },
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    ...(addCat === "all" ? {} : { categoryId: addCat }),
  };

  const [liveOfferItems, offeredOrders, endingSoon, offerTotal, addTotal, createProducts] =
    await Promise.all([
      prisma.productOffer.findMany({
        where: liveOfferWhere(now),
        distinct: ["menuItemId"],
        select: { menuItemId: true },
      }),
      prisma.order.count({
        where: {
          status: { not: "CANCELLED" },
          ...(overviewSince ? { createdAt: { gte: overviewSince } } : {}),
          items: { some: { offerId: { not: null } } },
        },
      }),
      prisma.productOffer.count({
        where: { ...liveOfferWhere(now), endsAt: { gt: now, lte: soon } },
      }),
      prisma.productOffer.count({ where: offerWhere }),
      prisma.menuItem.count({ where: addWhere }),
      // Every product "Create Offer" can pick from — the modal searches
      // them itself, so it isn't limited by the page's search box.
      prisma.menuItem.findMany({
        where: { isAvailable: true, offers: { none: currentOfferWhere(now) } },
        orderBy: { title: "asc" },
        take: 300,
        select: { id: true, title: true, price: true, imageUrl: true },
      }),
    ]);

  const offerPages = Math.max(1, Math.ceil(offerTotal / OFFERS_PAGE_SIZE));
  const offerPage = Math.min(readPage(params.page), offerPages);
  const addPages = Math.max(1, Math.ceil(addTotal / ADD_PAGE_SIZE));
  const addPage = Math.min(readPage(params.addPage), addPages);

  const [offers, addItems] = await Promise.all([
    prisma.productOffer.findMany({
      where: offerWhere,
      // By start date, so running offers come before scheduled ones (and
      // scheduled ones in the order they begin); ended ones newest first.
      orderBy:
        status === "ended"
          ? [{ endsAt: "desc" }]
          : status === "scheduled"
            ? [{ startsAt: "asc" }]
            : [{ startsAt: "asc" }, { createdAt: "desc" }],
      skip: (offerPage - 1) * OFFERS_PAGE_SIZE,
      take: OFFERS_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        audience: true,
        startsAt: true,
        endsAt: true,
        menuItem: { select: { id: true, title: true, price: true, imageUrl: true } },
      },
    }),
    prisma.menuItem.findMany({
      where: addWhere,
      orderBy: { title: "asc" },
      skip: (addPage - 1) * ADD_PAGE_SIZE,
      take: ADD_PAGE_SIZE,
      select: { id: true, title: true, price: true, imageUrl: true },
    }),
  ]);

  const stats = await offerOrderStats(offers.map((offer) => offer.id));

  const toProduct = (item: {
    id: string;
    title: string;
    price: { toNumber(): number };
    imageUrl: string | null;
  }): OfferProduct => ({
    id: item.id,
    title: item.title,
    price: item.price.toNumber(),
    imageUrl: item.imageUrl,
  });

  const overviewTiles = [
    {
      label: "Products on Offer",
      value: liveOfferItems.length,
      hint: "Currently discounted",
      icon: BadgePercent,
    },
    {
      label: "Orders Offer",
      value: offeredOrders,
      hint: PERIOD_HINTS[overviewPeriod],
      icon: ShoppingBag,
    },
    {
      label: "Ending Soon",
      value: endingSoon,
      hint: `Within ${ENDING_SOON_DAYS} days`,
      icon: TicketX,
    },
  ];

  const pageParams = {
    q,
    status: status === DEFAULT_OFFER_STATUS ? undefined : status,
    overview: params.overview,
    cat: cat === "all" ? undefined : cat,
    addCat: addCat === "all" ? undefined : addCat,
    page: params.page,
    addPage: params.addPage,
  };

  const range = (page: number, size: number, total: number) => ({
    start: total === 0 ? 0 : (page - 1) * size + 1,
    end: Math.min(page * size, total),
  });
  const addRange = range(addPage, ADD_PAGE_SIZE, addTotal);
  const offerRange = range(offerPage, OFFERS_PAGE_SIZE, offerTotal);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Welcome header — same markup as the dashboard ── */}
      <div className="flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-nowrap items-center gap-2.5 md:w-auto md:justify-start">
          <span className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black md:h-11 md:flex-none md:justify-start md:px-4 md:text-[14px]">
            <Calendar className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span>{day(now)}</span>
          </span>
          {/* The email broadcast to marketing subscribers (/admin/marketing)
              — announce an offer by email. Not in the Figma frame; it used
              to be what the sidebar's "Offers" opened. Icon-only on phones. */}
          <Link
            href="/admin/marketing"
            aria-label="Email subscribers"
            title="Email an offer to subscribers"
            className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black transition-colors hover:bg-black/[0.04] md:h-11 md:px-4 md:text-[14px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
          >
            <Mail className="h-4 w-4 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden min-[1100px]:inline">Email Subscribers</span>
          </Link>
          <ExportReportButton
            endpoint="/api/admin/offers/export"
            forwardParams={["q", "status", "cat"]}
            fallbackFilename="cuisine-offers.csv"
          />
        </div>
      </div>

      <OffersToolbar status={status} products={createProducts.map(toProduct)} money={money} />

      {/* ── Overview ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Overview</h2>
          <UrlFilterMenu
            param="overview"
            value={overviewPeriod}
            defaultValue="all"
            options={PERIOD_OPTIONS}
            ariaLabel="Period"
          />
        </div>

        {/* Figma: row, gap 20, three equal tiles. */}
        <div className="grid gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-5">
          {overviewTiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 font-frank-ruhl text-[18px] font-medium leading-tight text-black lg:text-[20px] lg:leading-none">
                  {tile.label}
                </h3>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <tile.icon className="h-[18px] w-[18px] text-black" strokeWidth={1.2} aria-hidden="true" />
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                  {tile.value.toLocaleString("en-US")}
                </p>
                <p className="font-sora text-[12px] font-normal leading-none text-black/70">{tile.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Offer cards ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>{OFFER_LIST_TITLES[status]}</h2>
          <UrlFilterMenu
            param="cat"
            value={cat}
            defaultValue="all"
            options={categoryOptions}
            ariaLabel="Category"
            resetParams={["page"]}
          />
        </div>

        {offers.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.5] text-black/70">
            {q || cat !== "all"
              ? "No offers match your search or filter."
              : status === "ended"
                ? "No offers have ended yet."
                : status === "scheduled"
                  ? "No offers are scheduled."
                  : "No offers running. Pick a product below, or use Create Offer."}
          </p>
        ) : (
          // Figma: row of 3 cards, gap 20. Two per row on tablets, one on
          // phones.
          <ul className="grid gap-4 min-[600px]:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {offers.map((offer) => {
              const state = offerStatus(offer, now);
              const offerPrice = applyOffer(offer.menuItem.price, offer, units);
              const orders = stats.get(offer.id)?.orders ?? 0;
              const members = offer.audience === "MEMBERS";

              const when =
                state === "scheduled"
                  ? `Starts ${day(offer.startsAt)}`
                  : state === "ended"
                    ? `Ended ${day(lastOfferDay(offer.endsAt!))}`
                    : offer.endsAt
                      ? `Ends ${day(lastOfferDay(offer.endsAt))}`
                      : "No end date";

              const editable: EditableOffer = {
                id: offer.id,
                product: toProduct(offer.menuItem),
                type: offer.type,
                value: offer.type === "PERCENT" ? (offer.percentOff ?? 0) : Number(offer.fixedOff ?? 0),
                audience: offer.audience,
                startDate: zonedISODate(offer.startsAt, tz),
                endDate: offer.endsAt ? zonedISODate(lastOfferDay(offer.endsAt), tz) : null,
              };

              return (
                <li
                  key={offer.id}
                  className={`flex min-w-0 flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-3 ${
                    state === "ended" ? "opacity-80" : ""
                  }`}
                >
                  <div className="relative aspect-[295/200] w-full overflow-hidden rounded-[12px] bg-white">
                    {offer.menuItem.imageUrl ? (
                      <Image
                        src={offer.menuItem.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 320px, (min-width: 600px) 45vw, 90vw"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed className="h-8 w-8 text-black/20" strokeWidth={1.5} aria-hidden="true" />
                      </span>
                    )}
                    {/* Figma: the discount in a white pill, top left. */}
                    <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-black">
                      {offerBadge(offer, settings.currency, units)}
                    </span>
                    {(state !== "active" || members) && (
                      <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-2 font-sora text-[12px] leading-[1.2] text-black">
                        {state === "scheduled" ? "Scheduled" : state === "ended" ? "Ended" : "Members only"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-start justify-between gap-3">
                      {/* Two lines at most, not "Crispy Hot …" — on a phone
                          the price pill leaves the name little room. */}
                      <h3 className="line-clamp-2 min-w-0 break-words font-frank-ruhl text-[18px] font-medium leading-[1.2] text-black min-[480px]:text-[20px]">
                        {offer.menuItem.title}
                      </h3>
                      <p className="flex shrink-0 items-baseline gap-2">
                        <s className="font-sora text-[12px] leading-none text-black/50">
                          <span className="sr-only">Normal price </span>
                          {label(offer.menuItem.price)}
                        </s>
                        <span className="font-frank-ruhl text-[18px] font-semibold leading-none text-black min-[480px]:text-[20px]">
                          {offerPrice ? label(offerPrice) : label(offer.menuItem.price)}
                        </span>
                      </p>
                    </div>
                    <p className="font-sora text-[12px] leading-[1.4] text-black/70">
                      {when}
                      {members && state !== "active" ? " · Members only" : ""}
                      {!offerPrice && " · Not applied: the discount is more than the price"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 px-1 pb-1">
                    <p className="font-frank-ruhl text-[18px] font-semibold leading-none text-black">
                      {orders.toLocaleString("en-US")} {orders === 1 ? "order" : "orders"}
                    </p>
                    <OfferCardActions
                      offer={editable}
                      status={state}
                      normalPriceLabel={label(offer.menuItem.price)}
                      money={money}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {offerPages > 1 && (
          <ListFooter
            start={offerRange.start}
            end={offerRange.end}
            total={offerTotal}
            noun={offerTotal === 1 ? "Offer" : "Offers"}
          >
            <Pagination
              currentPage={offerPage}
              totalPages={offerPages}
              searchParams={pageParams}
              basePath="/admin/offers"
            />
          </ListFooter>
        )}
      </section>

      {/* ── Add an Offer to a Product ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Add an Offer to a Product</h2>
          <UrlFilterMenu
            param="addCat"
            value={addCat}
            defaultValue="all"
            options={categoryOptions}
            ariaLabel="Category"
            resetParams={["addPage"]}
          />
        </div>

        {addItems.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.5] text-black/70">
            {q || addCat !== "all"
              ? "No products match your search or filter."
              : "Every product on the menu already has an offer."}
          </p>
        ) : (
          // Figma: column, gap 16; each row #F9F6F3, radius 16, padding 16.
          <ul className="flex flex-col gap-4">
            {addItems.map((item) => {
              const product = toProduct(item);
              return (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[16px] bg-[#F9F6F3] p-3 min-[480px]:gap-4 min-[480px]:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3 min-[480px]:gap-4">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-white min-[480px]:h-[60px] min-[480px]:w-[60px]">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="60px" unoptimized className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <UtensilsCrossed className="h-5 w-5 text-black/20" strokeWidth={1.5} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate font-frank-ruhl text-[16px] font-medium leading-[1.2] text-black min-[480px]:text-[20px]">
                        {item.title}
                      </p>
                      <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
                        {label(item.price)} · No active offer
                      </p>
                    </div>
                  </div>
                  <AddOfferButton product={product} money={money} />
                </li>
              );
            })}
          </ul>
        )}

        {addTotal > 0 && (
          <ListFooter
            start={addRange.start}
            end={addRange.end}
            total={addTotal}
            noun={addTotal === 1 ? "Product" : "Products"}
          >
            <Pagination
              currentPage={addPage}
              totalPages={addPages}
              searchParams={pageParams}
              basePath="/admin/offers"
              pageParam="addPage"
            />
          </ListFooter>
        )}
      </section>
    </div>
  );
}

/** "● Showing 1-5 of 20 Products" + page buttons — same as Reviews. */
function ListFooter({
  start,
  end,
  total,
  noun,
  children,
}: {
  start: number;
  end: number;
  total: number;
  noun: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
      <p className="flex items-center gap-2 font-sora text-[12px] leading-[15px] text-black/70">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" />
        <span>
          Showing{" "}
          <span className="font-semibold text-black">
            {start}-{end}
          </span>{" "}
          of <span className="font-semibold text-black">{total}</span> {noun}
        </span>
      </p>
      {/* 7 page buttons × 34px don't fit at 320px — shrink below 480px. */}
      <div className="min-w-0 max-[479px]:[&_nav>*]:h-7 max-[479px]:[&_nav>*]:w-7 max-[479px]:[&_nav]:gap-1">
        {children}
      </div>
    </div>
  );
}
