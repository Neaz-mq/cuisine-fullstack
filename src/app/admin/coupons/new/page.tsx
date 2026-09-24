import { redirect } from "next/navigation";

/**
 * The old "Add Coupon" page. Coupons are now created from the "Create
 * Coupon" modal on /admin/coupons, so an old bookmark lands there.
 */
export default function NewCouponPage() {
  redirect("/admin/coupons?create=1");
}
