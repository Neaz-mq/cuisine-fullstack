import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ActiveToggle from "./ActiveToggle";
import DeleteTableButton from "./DeleteTableButton";

export default async function AdminTablesPage() {
  const rawTables = await prisma.restaurantTable.findMany({
    include: {
      _count: { select: { reservations: true } },
    },
  });

  // Prisma-র string sort "T-10"-কে "T-1"-এর ঠিক পরে বসিয়ে দেয় (lexicographic),
  // কিন্তু আমরা চাই T-1, T-2, ... T-10 — natural/numeric order।
  // label থেকে সংখ্যা অংশ বের করে সেটার উপর ভিত্তি করে সাজানো হচ্ছে।
  const tables = [...rawTables].sort((a, b) => {
    const numA = parseInt(a.label.replace(/\D/g, ""), 10);
    const numB = parseInt(b.label.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Tables</h1>
        <Link
          href="/admin/tables/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Add Table
        </Link>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No tables yet. Add your first table to start accepting reservations.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {tables.map((table) => (
            <div
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-[100px]">
                <p className="text-sm font-medium text-gray-800">{table.label}</p>
                <p className="text-xs text-gray-400">
                  {table._count.reservations} reservation
                  {table._count.reservations !== 1 ? "s" : ""}
                </p>
              </div>

              <span className="text-sm text-gray-600">
                Capacity: {table.capacity}
              </span>

              <ActiveToggle tableId={table.id} isActive={table.isActive} />

              <div className="flex items-center gap-3 ml-auto">
                <Link
                  href={`/admin/tables/${table.id}/edit`}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                  Edit
                </Link>
                <DeleteTableButton tableId={table.id} tableLabel={table.label} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}