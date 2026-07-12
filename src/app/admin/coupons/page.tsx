import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ActiveToggle from "./ActiveToggle";
import DeleteCouponButton from "./DeleteCouponButton";

function formatDiscount(coupon: {
  type: string;
  percentOff: number | null;
  fixedOff: number | null;
  maxDiscountAmount: number | null;
}) {
  if (coupon.type === "FIXED") {
    return `$${coupon.fixedOff?.toFixed(2)} off`;
  }
  const cap = coupon.maxDiscountAmount ? ` (capped at $${coupon.maxDiscountAmount.toFixed(2)})` : "";
  return `${coupon.percentOff}% off${cap}`;
}

function isExpired(coupon: { expiresAt: Date | null }) {
  return !!coupon.expiresAt && coupon.expiresAt < new Date();
}

function formatRestriction(coupon: {
  restrictedCategories: { id: string; name: string }[];
  restrictedItems: { id: string; title: string }[];
}) {
  if (coupon.restrictedCategories.length > 0) {
    return `Only: ${coupon.restrictedCategories.map((c) => c.name).join(", ")}`;
  }
  if (coupon.restrictedItems.length > 0) {
    return coupon.restrictedItems.length <= 3
      ? `Only: ${coupon.restrictedItems.map((i) => i.title).join(", ")}`
      : `Only: ${coupon.restrictedItems.length} specific items`;
  }
  return null;
}

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { redemptions: true } },
      restrictedCategories: { select: { id: true, name: true } },
      restrictedItems: { select: { id: true, title: true } },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Coupons</h1>
        <Link
          href="/admin/coupons/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Add Coupon
        </Link>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No coupons yet. Add one to start offering discounts at checkout.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {coupons.map((coupon) => {
            const usedUp = coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit;
            const expired = isExpired(coupon);

            return (
              <div key={coupon.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-[160px]">
                  <p className="text-sm font-mono font-semibold text-gray-800">{coupon.code}</p>
                  <p className="text-xs text-gray-400">{formatDiscount(coupon)}</p>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                    {coupon.minOrderValue != null && (
                      <span>Min order ${coupon.minOrderValue.toFixed(2)}</span>
                    )}
                    {coupon.expiresAt && (
                      <span className={expired ? "text-red-500 font-medium" : ""}>
                        {expired ? "Expired" : "Expires"} {coupon.expiresAt.toLocaleDateString()}
                      </span>
                    )}
                    {coupon.usageLimit != null && (
                      <span>
                        {coupon.usageCount}/{coupon.usageLimit} used
                      </span>
                    )}
                    {coupon.usageLimit == null && coupon._count.redemptions > 0 && (
                      <span>{coupon._count.redemptions} used</span>
                    )}
                    <span>
                      {coupon.perCustomerLimit == null
                        ? "Unlimited per customer"
                        : `Max ${coupon.perCustomerLimit}/customer`}
                    </span>
                  </div>

                  {formatRestriction(coupon) && (
                    <p className="text-[11px] text-amber-600 font-medium mt-1">
                      {formatRestriction(coupon)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {usedUp && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                      Limit reached
                    </span>
                  )}
                  {expired && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600">
                      Expired
                    </span>
                  )}
                  <ActiveToggle couponId={coupon.id} isActive={coupon.isActive} />
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {coupon._count.redemptions === 0 && (
                    <DeleteCouponButton couponId={coupon.id} couponCode={coupon.code} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}