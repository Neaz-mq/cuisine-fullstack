import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AvailabilityToggle from "./AvailabilityToggle";
import DeleteMenuItemButton from "./DeleteMenuItemButton";

export default async function AdminMenuPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      menuItems: { orderBy: { title: "asc" } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Menu Management</h1>
        <Link
          href="/admin/menu/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Add Item
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-gray-500">No categories found. Add a category first.</p>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.id}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {category.name}
              </h2>

              {category.menuItems.length === 0 ? (
                <p className="text-sm text-gray-400 mb-2">No items in this category.</p>
              ) : (
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
                  {category.menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-[180px]">
                        <p className="text-sm font-medium text-gray-800">{item.title}</p>
                        <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                      </div>

                      <span className="text-sm font-semibold text-[#2C6252] w-16 text-right">
                        ${item.price.toFixed(2)}
                      </span>

                      <AvailabilityToggle itemId={item.id} isAvailable={item.isAvailable} />

                      <div className="flex items-center gap-3 ml-auto">
                        <Link
                          href={`/admin/menu/${item.id}/edit`}
                          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                        >
                          Edit
                        </Link>
                        <DeleteMenuItemButton itemId={item.id} itemTitle={item.title} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}