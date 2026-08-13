import { prisma } from "@/lib/prisma";
import AddInventoryItemForm from "./AddInventoryItemForm";
import InventoryItemActions from "./InventoryItemActions";

const UNIT_LABELS: Record<string, string> = {
  GRAM: "g",
  KILOGRAM: "kg",
  MILLILITER: "ml",
  LITER: "L",
  PIECE: "pc",
};

export default async function AdminInventoryPage() {
  // Includes inactive items too (unlike the public-facing /api/admin/inventory
  // GET, which only returns active ones) — a manager managing the raw list
  // needs to see everything, including items they've deactivated, to
  // reactivate one by mistake-checking rather than re-creating it.
  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { usedInRecipes: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Inventory</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Ingredients and stock items. Cost per unit here feeds directly into the food cost numbers
        on the{" "}
        <a href="/admin/insights" className="underline hover:text-gray-600">
          Insights
        </a>{" "}
        page — set a menu item&apos;s recipe from its edit page under Menu.
      </p>

      <AddInventoryItemForm />

      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500 mt-6">
          No inventory items yet. Add one above to get started.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white mt-6">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            <span>Name</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Reorder At</span>
            <span className="text-right">Cost / Unit</span>
            <span className="text-right">Used In</span>
            <span className="text-right">Status</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-4 gap-y-1 px-4 py-3 items-center"
            >
              <span className="text-sm text-gray-800 truncate col-span-2 sm:col-span-1">
                {item.name}
              </span>
              <span className="text-sm text-gray-600 text-right">
                {item.currentStock} {UNIT_LABELS[item.unit]}
              </span>
              <span className="text-sm text-gray-500 text-right">
                {item.reorderThreshold > 0 ? `${item.reorderThreshold} ${UNIT_LABELS[item.unit]}` : "—"}
              </span>
              <span className="text-sm text-gray-600 text-right">${item.costPerUnit.toFixed(4)}</span>
              <span className="text-sm text-gray-500 text-right">
                {item._count.usedInRecipes} recipe{item._count.usedInRecipes === 1 ? "" : "s"}
              </span>
              <div className="flex justify-end">
                <InventoryItemActions
                  itemId={item.id}
                  costPerUnit={item.costPerUnit.toNumber()}
                  isActive={item.isActive}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}