import type { Prisma } from "@/generated/prisma/client";
import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/coupon-filters.ts
 *
 * The "All Statuses" menu (toolbar) and the "All" type menu (All Coupons
 * card) on /admin/coupons, and the query the page and the CSV export both
 * use — so "Export Report" downloads exactly what is on screen.
 */
export type CouponStatusFilter = "all" | "active" | "scheduled" | "expired" | "inactive";
export type CouponTypeFilter = "all" | "percent" | "fixed" | "free-delivery";

export const DEFAULT_COUPON_STATUS: CouponStatusFilter = "all";
export const DEFAULT_COUPON_TYPE: CouponTypeFilter = "all";

export function isCouponStatusFilter(value: unknown): value is CouponStatusFilter {
  return typeof value === "string" && ["all", "active", "scheduled", "expired", "inactive"].includes(value);
}

export function isCouponTypeFilter(value: unknown): value is CouponTypeFilter {
  return typeof value === "string" && ["all", "percent", "fixed", "free-delivery"].includes(value);
}

export const COUPON_STATUS_OPTIONS: FilterMenuOption<CouponStatusFilter>[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

export const COUPON_TYPE_OPTIONS: FilterMenuOption<CouponTypeFilter>[] = [
  { value: "all", label: "All" },
  { value: "percent", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" },
  { value: "free-delivery", label: "Free Delivery" },
];

const TYPE_TO_DB = {
  percent: "PERCENT",
  fixed: "FIXED",
  "free-delivery": "FREE_DELIVERY",
} as const;

/** Switched on and inside its dates (it may still have hit its usage cap). */
export function liveCouponWhere(now: Date): Prisma.CouponWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

export function couponListWhere(
  { q, status, type }: { q?: string; status: CouponStatusFilter; type: CouponTypeFilter },
  now: Date
): Prisma.CouponWhereInput {
  const and: Prisma.CouponWhereInput[] = [];

  if (q) {
    and.push({
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
        { label: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (type !== "all") and.push({ type: TYPE_TO_DB[type] });

  switch (status) {
    case "active":
      and.push(liveCouponWhere(now));
      break;
    case "scheduled":
      and.push({
        isActive: true,
        startsAt: { gt: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      });
      break;
    case "expired":
      and.push({ expiresAt: { lte: now } });
      break;
    case "inactive":
      and.push({ isActive: false });
      break;
  }

  return and.length ? { AND: and } : {};
}
