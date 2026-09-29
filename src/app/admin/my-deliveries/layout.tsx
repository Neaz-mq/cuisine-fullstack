import { requireStaff } from "@/lib/require-admin";

// Section-level access gate for the rider panel: only staff with the
// "myDeliveries" scope — riders (Role.DELIVERY) and nobody else — may see
// anything under /admin/my-deliveries. Same pattern as every other
// section — see admin/kitchen/layout.tsx, admin/orders/layout.tsx, etc.
export default async function MyDeliveriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("myDeliveries");
  return <>{children}</>;
}
