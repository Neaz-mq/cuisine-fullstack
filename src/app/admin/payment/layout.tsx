import { requireStaff } from "@/lib/require-admin";

// "refunds", not "orders": moving an order through its statuses and
// sending a customer's money back are separate authorities in this app's
// permission matrix (see lib/permissions.ts), and this section is about
// the money.
export default async function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("refunds");
  return <>{children}</>;
}