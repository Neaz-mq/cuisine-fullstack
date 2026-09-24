import type { Prisma } from "@/generated/prisma/client";
import { getRestaurantSettings } from "@/lib/get-settings";
import { roundMoney, toMoney } from "@/lib/money";
import { nextISODate, zonedDayStart, zonedISODate } from "@/lib/product-offers";
import type { CouponFormInput } from "@/lib/validations/coupon";

/**
 * Shared by "create" (POST /api/admin/coupons) and "edit" (PATCH
 * /api/admin/coupons/[id]): turns the modal's values into the row to
 * write. Dates become instants in the restaurant's time zone — start at
 * midnight of the start day, stop at midnight after the expiry day.
 */
export async function couponDataFromForm(
  input: CouponFormInput,
  existing: { startsAt: Date | null } | null
): Promise<
  | {
      ok: true;
      data: Omit<Prisma.CouponUncheckedCreateInput, "restrictedCategories" | "restrictedItems" | "id">;
    }
  | { ok: false; error: string }
> {
  const settings = await getRestaurantSettings();
  const tz = settings.timezone;
  const units = settings.currencyMinorUnits;
  const today = zonedISODate(new Date(), tz);

  // A start date that was already set (possibly in the past) can stay;
  // a new or changed one can't be in the past.
  const keptStart =
    existing?.startsAt && input.startDate && zonedISODate(existing.startsAt, tz) === input.startDate;
  if (input.startDate && !keptStart && input.startDate < today) {
    return { ok: false, error: "Start date can't be in the past." };
  }

  const money = (value: number) => roundMoney(toMoney(value), units);

  return {
    ok: true,
    data: {
      code: input.code,
      label: input.label,
      headline: input.headline,
      description: input.description,
      isActive: input.isActive,
      type: input.type,
      percentOff: input.type === "PERCENT" ? (input.value ?? null) : null,
      fixedOff: input.type === "FIXED" && input.value != null ? money(input.value) : null,
      // A cap only means something on a percentage.
      maxDiscountAmount:
        input.type === "PERCENT" && input.maxDiscountAmount != null ? money(input.maxDiscountAmount) : null,
      minOrderValue: input.minOrderValue != null && input.minOrderValue > 0 ? money(input.minOrderValue) : null,
      usageLimit: input.usageLimit ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      startsAt: keptStart ? existing!.startsAt : input.startDate ? zonedDayStart(input.startDate, tz) : null,
      expiresAt: input.endDate ? zonedDayStart(nextISODate(input.endDate), tz) : null,
      audience: input.audience,
    },
  };
}

export type CouponState = "active" | "scheduled" | "expired" | "inactive" | "used_up";

/** What a coupon is doing right now — for the status pill and filters. */
export function couponState(
  coupon: {
    isActive: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
    usageLimit: number | null;
    usageCount: number;
  },
  now: Date = new Date()
): CouponState {
  if (!coupon.isActive) return "inactive";
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "expired";
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return "used_up";
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) return "scheduled";
  return "active";
}

export const COUPON_STATE_LABELS: Record<CouponState, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  inactive: "Inactive",
  used_up: "Used Up",
};
