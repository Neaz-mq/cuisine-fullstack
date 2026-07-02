import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MenuItemForm from "../../MenuItemForm";

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!item) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Edit Menu Item</h1>
      <MenuItemForm categories={categories} initialData={item} />
    </div>
  );
}