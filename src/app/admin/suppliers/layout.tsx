import { requireStaff } from "@/lib/require-admin";

// "suppliers" scope — the same one /api/admin/suppliers requires, so the
// page and its own API never disagree about who's allowed in. (It used to
// be "inventory"; split so a MANAGER keeps Suppliers without Inventory.)
export default async function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff("suppliers");
  return <>{children}</>;
}