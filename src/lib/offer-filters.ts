import type { Prisma } from "@/generated/prisma/client";
import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/offer-filters.ts
 *
 * The "All Statuses" menu on /admin/offers, and the query both the page and
 * the CSV export use, so "Export Report" always downloads exactly what is
 * on screen.
 *
 * "All Statuses" means every offer that has not ended yet (running +
 * scheduled). Ended offers are history — they have their own choice so
 * they don't crowd the cards staff work with every day.
 */
export type OfferStatusFilter = "current" | "active" | "scheduled" | "ended";

export const DEFAULT_OFFER_STATUS: OfferStatusFilter = "current";

export function isOfferStatusFilter(value: unknown): value is OfferStatusFilter {
  return (
    typeof value === "string" && ["current", "active", "scheduled", "ended"].includes(value)
  );
}

export const OFFER_STATUS_OPTIONS: FilterMenuOption<OfferStatusFilter>[] = [
  { value: "current", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
];

/** The card title above the offer cards, for each filter. */
export const OFFER_LIST_TITLES: Record<OfferStatusFilter, string> = {
  current: "Active Product Offers",
  active: "Active Product Offers",
  scheduled: "Scheduled Offers",
  ended: "Ended Offers",
};

export function offerStatusWhere(
  status: OfferStatusFilter,
  now: Date
): Prisma.ProductOfferWhereInput {
  switch (status) {
    case "active":
      return { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
    case "scheduled":
      return { startsAt: { gt: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
    case "ended":
      return { endsAt: { lte: now } };
    default:
      return { OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  }
}

export function offerListWhere(
  { q, status, categoryId }: { q?: string; status: OfferStatusFilter; categoryId?: string },
  now: Date
): Prisma.ProductOfferWhereInput {
  const menuItem: Prisma.MenuItemWhereInput = {
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
  return {
    ...offerStatusWhere(status, now),
    ...(Object.keys(menuItem).length > 0 ? { menuItem } : {}),
  };
}
