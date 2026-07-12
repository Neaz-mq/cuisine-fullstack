import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ActiveToggle from "./ActiveToggle";
import DeleteCouponButton from "./DeleteCouponButton";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

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
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-[120px]">
                <p className="text-sm font-mono font-semibold text-gray-800">
                  {coupon.code}
                </p>
                <p className="text-xs text-gray-400">
                  {coupon.percentOff}% off
                </p>
              </div>

              {coupon.usedByOrderId ? (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                  Used {coupon.usedAt ? new Date(coupon.usedAt).toLocaleDateString() : ""}
                </span>
              ) : (
                <ActiveToggle couponId={coupon.id} isActive={coupon.isActive} />
              )}

              <div className="flex items-center gap-3 ml-auto">
                {!coupon.usedByOrderId && (
                  <DeleteCouponButton couponId={coupon.id} couponCode={coupon.code} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}