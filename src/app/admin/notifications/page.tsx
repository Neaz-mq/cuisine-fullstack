import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Notification" };

export default function NotificationsPage() {
  return (
    <ComingSoon
      title="Notification"
      description="A running feed of new orders, reservations and low-stock alerts. Not built yet — the bell in the top bar already polls for new orders and takes you straight to them."
      action={{ label: "View new orders", href: "/admin/orders?status=PLACED" }}
    />
  );
}