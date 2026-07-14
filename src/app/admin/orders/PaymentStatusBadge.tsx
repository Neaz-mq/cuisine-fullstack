/**
 * src/app/admin/orders/PaymentStatusBadge.tsx
 *
 * Surfaces Order.paymentStatus in the admin Orders list. Before this, the
 * only way to tell whether an "Online Payment" order had actually been
 * paid — as opposed to the Stripe webhook simply not having fired yet, or
 * having failed — was to check the database directly. Kitchen/front-of-house
 * staff need this at a glance so they don't start preparing an order that
 * was never actually paid for.
 *
 * Intentionally only rendered for paymentMethod === "ONLINE" by the caller
 * — COD/Pay-at-Table orders are settled in person and their paymentStatus
 * sits at its PENDING default forever, so showing it there would just look
 * like an unpaid warning on every cash order.
 */
const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PENDING: "Payment pending",
  FAILED: "Payment failed",
};

export default function PaymentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}