import { requireStaff } from "@/lib/require-admin";

// "inventory" scope, deliberately matching what the suppliers and
// purchase-order API routes already require (see
// /api/admin/suppliers/route.ts) — the page and its own API should never
// disagree about who's allowed in.
export default async function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("inventory");
  return <>{children}</>;
}