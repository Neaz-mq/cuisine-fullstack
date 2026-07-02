import { prisma } from "@/lib/prisma";
import MenuItemForm from "../MenuItemForm";

export default async function NewMenuItemPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Add Menu Item</h1>
      <MenuItemForm categories={categories} />
    </div>
  );
}