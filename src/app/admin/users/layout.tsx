import { requireStaff } from "@/lib/require-admin";

// Section-level access gate, same shape as every other admin section.
// Customer records are people-data, so this rides on the "staff" scope
// (OWNER/MANAGER only) rather than something broader like "orders" —
// a WAITER needs to see today's orders, not the full customer list.
export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("staff");
  return <>{children}</>;
}