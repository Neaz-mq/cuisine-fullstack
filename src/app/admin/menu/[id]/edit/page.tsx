import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MenuItemForm from "../../MenuItemForm";
import RecipeEditor from "../../RecipeEditor";

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [item, categories, inventoryItems] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
  ]);

  if (!item) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Edit Menu Item</h1>
      {/* MenuItemForm একটা client component, তার input string-এ কাজ
          করে — তাই Decimal price এখানে number-এ নামিয়ে দেওয়া হচ্ছে। */}
      <MenuItemForm
        categories={categories}
        initialData={{ ...item, price: item.price.toNumber() }}
      />

      <div className="mt-8 border border-gray-200 rounded-md p-6 bg-white">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Recipe
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Ingredients and quantities needed to make ONE unit of this item. Drives the food cost
          shown on Insights and stock deduction on order.
        </p>
        <RecipeEditor menuItemId={item.id} inventoryItems={inventoryItems} />
      </div>
    </div>
  );
}