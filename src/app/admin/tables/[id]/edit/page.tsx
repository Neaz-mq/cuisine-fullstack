import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TableForm from "../../TableForm";

export default async function EditTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const table = await prisma.restaurantTable.findUnique({ where: { id } });

  if (!table) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Edit Table</h1>
      <TableForm initialData={table} />
    </div>
  );
}