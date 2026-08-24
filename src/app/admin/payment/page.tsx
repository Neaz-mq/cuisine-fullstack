import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Payment" };

export default function PaymentPage() {
  return (
    <ComingSoon
      title="Payment"
      description="A consolidated view of charges, payment status and the refund ledger. Not built yet — for now, refunds are issued from an individual order's detail page."
      action={{ label: "Go to Orders", href: "/admin/orders" }}
    />
  );
}