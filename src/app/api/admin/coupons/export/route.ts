import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import {
  DEFAULT_COUPON_STATUS,
  DEFAULT_COUPON_TYPE,
  couponListWhere,
  isCouponStatusFilter,
  isCouponTypeFilter,
} from "@/lib/coupon-filters";
import { COUPON_STATE_LABELS, couponState } from "@/lib/coupon-admin";
import { lastOfferDay } from "@/lib/product-offers";

/**
 * GET /api/admin/coupons/export — "Export Report" on /admin/coupons.
 * Same filters as the page (?q=, ?status=, ?type=).
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("coupons");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "coupons-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const rawStatus = searchParams.get("status");
  const status = isCouponStatusFilter(rawStatus) ? rawStatus : DEFAULT_COUPON_STATUS;
  const rawType = searchParams.get("type");
  const type = isCouponTypeFilter(rawType) ? rawType : DEFAULT_COUPON_TYPE;

  try {
    const now = new Date();
    const settings = await getRestaurantSettings();
    const units = settings.currencyMinorUnits;

    const coupons = await prisma.coupon.findMany({
      where: couponListWhere({ q, status, type }, now),
      orderBy: { createdAt: "desc" },
      include: {
        restrictedCategories: { select: { name: true } },
        restrictedItems: { select: { title: true } },
        _count: { select: { redemptions: true } },
      },
    });

    const day = (date: Date) =>
      date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: settings.timezone });
    const money = (value: { toFixed(d: number): string } | null) => (value ? value.toFixed(units) : "");

    const header = [
      "Code",
      "Label",
      "Headline",
      "Discount",
      "Minimum Order",
      "Max Discount",
      "Applies To",
      "Valid On",
      "Uses",
      "Usage Limit",
      "Per Customer",
      "Starts",
      "Expires",
      "Status",
    ];
    const rows = coupons.map((coupon) => [
      coupon.code,
      coupon.label ?? "",
      coupon.headline ?? "",
      coupon.type === "FREE_DELIVERY"
        ? "Free delivery"
        : coupon.type === "PERCENT"
          ? `${coupon.percentOff}%`
          : `${money(coupon.fixedOff)} off`,
      money(coupon.minOrderValue),
      money(coupon.maxDiscountAmount),
      coupon.audience === "NEW_CUSTOMERS"
        ? "First-time customers"
        : coupon.audience === "MEMBERS"
          ? "Members only"
          : "All customers",
      coupon.restrictedCategories.length
        ? coupon.restrictedCategories.map((c) => c.name).join("; ")
        : coupon.restrictedItems.length
          ? coupon.restrictedItems.map((i) => i.title).join("; ")
          : "Whole menu",
      coupon.usageCount,
      coupon.usageLimit ?? "No limit",
      coupon.perCustomerLimit ?? "No limit",
      coupon.startsAt ? day(coupon.startsAt) : "",
      coupon.expiresAt ? day(lastOfferDay(coupon.expiresAt)) : "No expiry",
      COUPON_STATE_LABELS[couponState(coupon, now)],
    ]);

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(header, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cuisine-coupons-${status}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/admin/coupons/export error:", error);
    return NextResponse.json({ error: "Couldn't build the coupons export. Please try again." }, { status: 500 });
  }
}
