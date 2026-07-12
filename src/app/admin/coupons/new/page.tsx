import CouponForm from "../CouponForm";

export default function NewCouponPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Add Coupon</h1>
      <CouponForm />
    </div>
  );
}