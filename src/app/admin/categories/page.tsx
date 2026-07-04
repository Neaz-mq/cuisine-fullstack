import { prisma } from "@/lib/prisma";
import Link from "next/link";
import DeleteCategoryButton from "./DeleteCategoryButton";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { menuItems: true } },
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Categories</h1>
        <Link
          href="/admin/categories/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Add Category
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No categories yet. Add your first category to start building the menu.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{category.name}</p>
                <p className="text-xs text-gray-400">
                  {category._count.menuItems} item
                  {category._count.menuItems !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/categories/${category.id}/edit`}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Edit
                </Link>
                <DeleteCategoryButton
                  categoryId={category.id}
                  categoryName={category.name}
                  itemCount={category._count.menuItems}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}