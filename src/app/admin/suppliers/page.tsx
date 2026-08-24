import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Suppliers" };

export default function SuppliersPage() {
  return (
    <ComingSoon
      title="Suppliers"
      description="Supplier records and purchase orders already exist in the database and API — this screen for managing them hasn't been built yet. Stock levels and movements are on the Inventory page."
      action={{ label: "Go to Inventory", href: "/admin/inventory" }}
    />
  );
}