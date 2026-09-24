import { CircleCheck, Calendar, ThumbsUp, TicketX } from "lucide-react";
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
  COUPON_TYPE_OPTIONS,
  DEFAULT_COUPON_STATUS,
  DEFAULT_COUPON_TYPE,
  couponListWhere,
  isCouponStatusFilter,
  isCouponTypeFilter,
  liveCouponWhere,
} from "@/lib/coupon-filters";
import { COUPON_STATE_LABELS, couponState, type CouponState } from "@/lib/coupon-admin";
import { lastOfferDay, zonedISODate } from "@/lib/product-offers";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import Pagination from "../orders/Pagination";
import UrlFilterMenu from "../offers/UrlFilterMenu";
import CouponsToolbar from "./CouponsToolbar";
import CouponRowActions from "./CouponRowActions";
import type { CategoryOption, CouponFormValues } from "./types";

export const metadata = { title: "Coupons" };

/**
 * /admin/coupons — built to the Figma "Coupons" frame (1059 wide, column,
 * gap 24):
 *
 *   Welcome header · date pill · Export Report
 *   Search + All Statuses + Create Coupon
 *   Overview (3 tiles, own period: ?overview=)
 *   Active Coupons (coloured cards — the coupons customers can use now)
 *   All Coupons (rows, type filter ?type=, 5 per page: ?page=)
 *
 * A coupon is a code the customer types at checkout. Every rule is checked
 * there (findValidCoupon / consumeCoupon in order-checkout-shared.ts).
 * Same card, title and tile styles as the Offers and Reviews pages.
 */

const PAGE_SIZE = 5;
const MAX_ACTIVE_CARDS = 6;
const EXPIRING_SOON_DAYS = 7;

// Same three colours as the menu page's "Today's Offers" cards.
const CARD_COLORS = ["#FF9540", "#6DCB66", "#AE80FF"];

const CARD = "flex min-w-0 flex-col gap-6 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]";
const CARD_TITLE =
  "min-w-0 font-frank-ruhl text-[22px] font-semibold leading-tight text-black min-[480px]:text-[24px] min-[480px]:leading-none xl:text-[30px]";
const FIELD_LABEL = "font-sora text-[12px] font-normal leading-none text-black/70 min-[480px]:text-[14px]";
const FIELD_VALUE = "font-frank-ruhl text-[15px] font-medium leading-tight text-black min-[480px]:text-[16px]";

const PERIOD_OPTIONS = DASHBOARD_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }));
const PERIOD_HINTS: Record<DashboardPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

const STATE_STYLES: Record<CouponState, string> = {
  active: "bg-[#E8FFEC] text-[#0ECF00]",
  scheduled: "bg-[#FFF2DA] text-[#FF9E00]",
  expired: "bg-black/[0.06] text-black/60",
  used_up: "bg-black/[0.06] text-black/60",
  inactive: "bg-[#FFE9EC] text-[#FF3F5C]",
};

type SearchParams = { q?: string; status?: string; type?: string; overview?: string; page?: string };

type DecimalLike = { toFixed(digits: number): string } | null;

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff("coupons");
  const params = await searchParams;

  const q = params.q?.trim() || undefined;
  const status = isCouponStatusFilter(params.status) ? params.status : DEFAULT_COUPON_STATUS;
  const type = isCouponTypeFilter(params.type) ? params.type : DEFAULT_COUPON_TYPE;
  const overviewPeriod: DashboardPeriod = isDashboardPeriod(params.overview) ? params.overview : "all";
  const requestedPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const now = new Date();
  const settings = await getRestaurantSettings();
  const tz = settings.timezone;
  const units = settings.currencyMinorUnits;
  const money = (value: DecimalLike) => (value ? formatAmount(value.toFixed(units), settings.currency) : "");
  const day = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });

  const discountText = (coupon: { type: string; percentOff: number | null; fixedOff: DecimalLike }) =>
    coupon.type === "FREE_DELIVERY"
      ? "Free Delivery"
      : coupon.type === "PERCENT"
        ? `${coupon.percentOff ?? 0}% Off`
        : `${money(coupon.fixedOff)} Off`;

  const overviewSince = periodStart(overviewPeriod, now);
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
  const listWhere = couponListWhere({ q, status, type }, now);

  const [categories, liveCoupons, totalClaims, expiringSoon, listTotal] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.coupon.findMany({
      where: liveCouponWhere(now),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        label: true,
        headline: true,
        description: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        minOrderValue: true,
        usageLimit: true,
        usageCount: true,
        expiresAt: true,
        restrictedCategories: { select: { name: true } },
      },
    }),
    prisma.couponRedemption.count({
      where: overviewSince ? { createdAt: { gte: overviewSince } } : {},
    }),
    prisma.coupon.count({ where: { AND: [liveCouponWhere(now), { expiresAt: { gt: now, lte: soon } }] } }),
    prisma.coupon.count({ where: listWhere }),
  ]);

  // "Live" in the database but out of uses isn't something customers can use.
  const usable = liveCoupons.filter((c) => c.usageLimit === null || c.usageCount < c.usageLimit);

  const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const coupons = await prisma.coupon.findMany({
    where: listWhere,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      restrictedCategories: { select: { id: true, name: true } },
      restrictedItems: { select: { id: true, title: true } },
    },
  });

  const categoryOptions: CategoryOption[] = categories;

  const tiles = [
    { label: "Active Coupons", value: usable.length, hint: "Currently live", icon: CircleCheck },
    { label: "Total Claims", value: totalClaims, hint: PERIOD_HINTS[overviewPeriod], icon: ThumbsUp },
    { label: "Expiring Soon", value: expiringSoon, hint: `Within ${EXPIRING_SOON_DAYS} days`, icon: TicketX },
  ];

  const start = listTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, listTotal);

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
          <ExportReportButton
            endpoint="/api/admin/coupons/export"
            forwardParams={["q", "status", "type"]}
            fallbackFilename="cuisine-coupons.csv"
          />
        </div>
      </div>

      <CouponsToolbar status={status} categories={categoryOptions} currency={settings.currency} />

      {/* ── Overview ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Overview</h2>
          <UrlFilterMenu param="overview" value={overviewPeriod} defaultValue="all" options={PERIOD_OPTIONS} ariaLabel="Period" />
        </div>
        <div className="grid gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 md:gap-5">
          {tiles.map((tile) => (
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

      {/* ── Active Coupons — what customers can use right now ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>Active Coupons</h2>
          {usable.length > MAX_ACTIVE_CARDS && (
            <span className="font-sora text-[12px] text-black/60">
              Newest {MAX_ACTIVE_CARDS} of {usable.length}
            </span>
          )}
        </div>

        {usable.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.5] text-black/70">
            No coupon is live right now. Use Create Coupon to add one.
          </p>
        ) : (
          <ul className="grid gap-4 min-[600px]:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {usable.slice(0, MAX_ACTIVE_CARDS).map((coupon, index) => {
              const scope = coupon.restrictedCategories.length
                ? coupon.restrictedCategories.map((c) => c.name).join(", ")
                : "Every Order";
              const headline = coupon.headline || `${discountText(coupon)} ${coupon.type === "FREE_DELIVERY" ? "" : "Your Order"}`.trim();
              const description =
                coupon.description ||
                `Use the code at checkout${
                  coupon.minOrderValue ? ` on orders over ${money(coupon.minOrderValue)}` : ""
                }.`;
              return (
                <li
                  key={coupon.id}
                  className="flex min-h-[220px] min-w-0 flex-col justify-between gap-5 rounded-[20px] p-5 text-white xl:p-6"
                  style={{ backgroundColor: CARD_COLORS[index % CARD_COLORS.length] }}
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-frank-ruhl text-[18px] font-normal leading-tight xl:text-[20px]">
                        {coupon.label || scope}
                      </span>
                      <span className="shrink-0 rounded-full border border-dashed border-white px-3 py-1.5 font-sora text-[11px] font-semibold uppercase leading-none tracking-wide">
                        {coupon.code}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="font-frank-ruhl text-[20px] font-medium leading-tight xl:text-[22px]">{headline}</p>
                      <p className="line-clamp-2 font-sora text-[12px] leading-[1.6] text-white/80">{description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/40 pt-4">
                    <span className="font-frank-ruhl text-[16px] font-semibold leading-none">
                      {coupon.usageCount.toLocaleString("en-US")}
                      {coupon.usageLimit !== null ? ` / ${coupon.usageLimit.toLocaleString("en-US")}` : ""} Used
                    </span>
                    <span className="font-sora text-[11px] leading-none text-white/85">
                      {coupon.expiresAt ? `Expires ${day(lastOfferDay(coupon.expiresAt))}` : "No expiry"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── All Coupons ── */}
      <section className={CARD}>
        <div className="flex items-center justify-between gap-4">
          <h2 className={CARD_TITLE}>All Coupons</h2>
          <UrlFilterMenu
            param="type"
            value={type}
            defaultValue={DEFAULT_COUPON_TYPE}
            options={COUPON_TYPE_OPTIONS}
            ariaLabel="Discount type"
            resetParams={["page"]}
          />
        </div>

        {coupons.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.5] text-black/70">
            {q || status !== DEFAULT_COUPON_STATUS || type !== DEFAULT_COUPON_TYPE
              ? "No coupons match your search or filter."
              : "No coupons yet. Use Create Coupon to add the first one."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {coupons.map((coupon) => {
              const state = couponState(coupon, now);
              const limitNote = coupon.restrictedCategories.length
                ? `Only: ${coupon.restrictedCategories.map((c) => c.name).join(", ")}`
                : coupon.restrictedItems.length
                  ? `Only: ${coupon.restrictedItems.length} dish${coupon.restrictedItems.length === 1 ? "" : "es"}`
                  : null;
              const audienceNote =
                coupon.audience === "NEW_CUSTOMERS"
                  ? "First-time customers"
                  : coupon.audience === "MEMBERS"
                    ? "Members only"
                    : null;

              const editable: CouponFormValues = {
                id: coupon.id,
                code: coupon.code,
                label: coupon.label ?? "",
                headline: coupon.headline ?? "",
                description: coupon.description ?? "",
                isActive: coupon.isActive,
                type: coupon.type,
                value:
                  coupon.type === "PERCENT"
                    ? String(coupon.percentOff ?? "")
                    : coupon.type === "FIXED" && coupon.fixedOff
                      ? coupon.fixedOff.toFixed(units)
                      : "",
                minOrderValue: coupon.minOrderValue ? coupon.minOrderValue.toFixed(units) : "",
                usageLimit: coupon.usageLimit !== null ? String(coupon.usageLimit) : "",
                maxDiscountAmount: coupon.maxDiscountAmount ? coupon.maxDiscountAmount.toFixed(units) : "",
                perCustomerLimit: coupon.perCustomerLimit !== null ? String(coupon.perCustomerLimit) : "",
                startDate: coupon.startsAt ? zonedISODate(coupon.startsAt, tz) : "",
                endDate: coupon.expiresAt ? zonedISODate(lastOfferDay(coupon.expiresAt), tz) : "",
                audience: coupon.audience,
                restrictedCategoryIds: coupon.restrictedCategories.map((c) => c.id),
                restrictedItems: coupon.restrictedItems,
                usageCount: coupon.usageCount,
              };

              return (
                <li
                  key={coupon.id}
                  className={[
                    "grid min-w-0 items-center gap-4 rounded-[16px] bg-[#F9F6F3] p-4",
                    "[grid-template-areas:'who'_'meta'_'actions']",
                    "md:grid-cols-[minmax(0,1fr)_auto] md:[grid-template-areas:'who_actions'_'meta_meta']",
                    "xl:grid-cols-[minmax(150px,1fr)_minmax(0,560px)_auto] xl:gap-6 xl:[grid-template-areas:'who_meta_actions']",
                  ].join(" ")}
                >
                  {/* Code + headline */}
                  <div className="flex min-w-0 flex-col gap-1.5 [grid-area:who]">
                    <p className="truncate font-frank-ruhl text-[18px] font-semibold uppercase leading-tight tracking-wide text-black min-[480px]:text-[20px]">
                      {coupon.code}
                    </p>
                    <p className="truncate font-sora text-[12px] leading-[1.5] text-black/70">
                      {[coupon.headline || coupon.label, audienceNote, limitNote].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>

                  {/* Discount | Uses | Expires | Status */}
                  <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 [grid-area:meta] min-[560px]:grid-cols-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="flex min-w-0 flex-col gap-3">
                      <span className={FIELD_LABEL}>Discount</span>
                      <span className={`${FIELD_VALUE} truncate`}>
                        {discountText(coupon)}
                        {coupon.minOrderValue ? (
                          <span className="block font-sora text-[11px] font-normal text-black/60">
                            Min {money(coupon.minOrderValue)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <span className={FIELD_LABEL}>Uses</span>
                      <span className={FIELD_VALUE}>
                        {coupon.usageCount.toLocaleString("en-US")}
                        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit.toLocaleString("en-US")}` : ""}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <span className={FIELD_LABEL}>Expires</span>
                      <span className={`${FIELD_VALUE} whitespace-nowrap`}>
                        {coupon.expiresAt ? day(lastOfferDay(coupon.expiresAt)) : "No expiry"}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <span className={FIELD_LABEL}>Status</span>
                      <span
                        className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] leading-none min-[480px]:h-9 ${STATE_STYLES[state]}`}
                      >
                        {COUPON_STATE_LABELS[state]}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 [grid-area:actions] xl:justify-self-end">
                    <CouponRowActions coupon={editable} categories={categoryOptions} currency={settings.currency} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {listTotal > 0 && (
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <p className="flex items-center gap-2 font-sora text-[12px] leading-[15px] text-black/70">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]" />
              <span>
                Showing{" "}
                <span className="font-semibold text-black">
                  {start}-{end}
                </span>{" "}
                of <span className="font-semibold text-black">{listTotal}</span> {listTotal === 1 ? "Coupon" : "Coupons"}
              </span>
            </p>
            <div className="min-w-0 max-[479px]:[&_nav>*]:h-7 max-[479px]:[&_nav>*]:w-7 max-[479px]:[&_nav]:gap-1">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                searchParams={{
                  q,
                  status: status === DEFAULT_COUPON_STATUS ? undefined : status,
                  type: type === DEFAULT_COUPON_TYPE ? undefined : type,
                  overview: params.overview,
                }}
                basePath="/admin/coupons"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
