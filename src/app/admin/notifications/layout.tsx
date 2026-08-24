import { requireStaff } from "@/lib/require-admin";

// "orders" scope — every notification this app currently raises is about
// an order arriving, so anyone who can't see orders has nothing to read
// here anyway.
export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("orders");
  return <>{children}</>;
}