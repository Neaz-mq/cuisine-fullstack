import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import {
  DEFAULT_OFFER_STATUS,
  isOfferStatusFilter,
  offerListWhere,
  type OfferStatusFilter,
} from "@/lib/offer-filters";
import { applyOffer, lastOfferDay, offerStatus } from "@/lib/product-offers";
import { offerOrderStats } from "@/lib/offer-admin";

/**
 * GET /api/admin/offers/export — "Export Report" on /admin/offers.
 *
 * Same filters as the page (?q=, ?status=, ?cat=), built by the same
 * offerListWhere(), so the file matches what is on screen.
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("marketing");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "offers-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const rawStatus = searchParams.get("status");
  const status: OfferStatusFilter = isOfferStatusFilter(rawStatus) ? rawStatus : DEFAULT_OFFER_STATUS;
  const categoryId = searchParams.get("cat")?.trim() || undefined;

  try {
    const now = new Date();
    const settings = await getRestaurantSettings();
    const units = settings.currencyMinorUnits;

    const offers = await prisma.productOffer.findMany({
      where: offerListWhere({ q, status, categoryId }, now),
      orderBy: [{ startsAt: "desc" }],
      select: {
        id: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        audience: true,
        startsAt: true,
        endsAt: true,
        menuItem: { select: { title: true, price: true, category: { select: { name: true } } } },
      },
    });
    const stats = await offerOrderStats(offers.map((offer) => offer.id));

    const day = (date: Date) =>
      date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: settings.timezone,
      });

    const header = [
      "Product",
      "Category",
      "Discount",
      "Normal Price",
      "Offer Price",
      "Applies To",
      "Starts",
      "Ends",
      "Status",
      "Orders",
      "Units Sold",
      "Customer Savings",
    ];
    const rows = offers.map((offer) => {
      const offerPrice = applyOffer(offer.menuItem.price, offer, units);
      const stat = stats.get(offer.id);
      const state = offerStatus(offer, now);
      return [
        offer.menuItem.title,
        offer.menuItem.category.name,
        offer.type === "PERCENT"
          ? `${offer.percentOff}%`
          : `${Number(offer.fixedOff).toFixed(units)} off`,
        offer.menuItem.price.toFixed(units),
        offerPrice ? offerPrice.toFixed(units) : "",
        offer.audience === "MEMBERS" ? "Members only" : "All customers",
        day(offer.startsAt),
        offer.endsAt ? day(lastOfferDay(offer.endsAt)) : "No end date",
        state.charAt(0).toUpperCase() + state.slice(1),
        stat?.orders ?? 0,
        stat?.units ?? 0,
        stat ? stat.savings.toFixed(units) : (0).toFixed(units),
      ];
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cuisine-offers-${status}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/offers/export error:", error);
    return NextResponse.json(
      { error: "Couldn't build the offers export. Please try again." },
      { status: 500 }
    );
  }
}
