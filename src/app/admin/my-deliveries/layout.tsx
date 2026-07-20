import { requireStaff } from "@/lib/require-admin";

// Section-level access gate: only staff with the "myDeliveries" scope
// (Role.DELIVERY, plus OWNER/MANAGER since they get every scope) may see
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
