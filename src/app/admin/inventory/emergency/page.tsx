import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { stockStateOf } from "@/lib/inventory-status";
import InventoryRow, { type InventoryRowItem } from "../InventoryRow";

export const metadata = { title: "Emergency stock" };

/**
 * src/app/admin/inventory/emergency/page.tsx
 *
 * Inventory পাতার gradient banner-এ "View Emergency Items" চাপলে এখানে।
 *
 * ── কেন আলাদা পাতা, ছাঁকনি নয় ───────────────────────────────────────
 *
 * উপরের toolbar-এ "Emergency" ছাঁকনিটা আছেই, অর্থাৎ কাজটা ওখান থেকেও
 * করা যায়। তবু এটা আলাদা পাতা, দুটো কারণে।
 *
 * এক, banner-টা একটা **সতর্কবার্তা**, আর সতর্কবার্তার বোতাম একটা
 * নির্দিষ্ট জায়গায় নিয়ে যাওয়াই উচিত — ছাঁকনি বদলে দিলে ব্যবহারকারী
 * ভাবতেন কিছুই হয়নি (পাতা একই দেখাত, শুধু কম সারি)।
 *
 * দুই, এই পাতাটার ঠিকানা আছে — WhatsApp-এ পাঠানো যায় ("এই লিঙ্কটা
 * দেখুন")। ছাঁকনির URL-ও পাঠানো যেত, কিন্তু সেটা মনে রাখার মতো নয়।
 *
 * ⚠️ "Out of Stock" জিনিসগুলোও এখানে আসে, যদিও সেগুলোর অবস্থা
 * আলাদা। কারণ কাজটা এক: এক্ষুনি অর্ডার দাও। ফুরিয়ে যাওয়া জিনিস
 * বাদ দিলে এই পাতাটা "প্রায় ফুরিয়ে গেছে" দেখাত অথচ "একদম নেই"
 * দেখাত না — যা উল্টো হতো।
 */
export default async function EmergencyInventoryPage() {
  await requireStaff("inventory");

  const [rows, suppliers] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { currentStock: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderThreshold: true,
        emergencyThreshold: true,
        maxCapacity: true,
        costPerUnit: true,
        category: true,
        supplierId: true,
        image: true,
        supplier: { select: { name: true } },
        _count: { select: { usedInRecipes: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items: InventoryRowItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    currentStock: row.currentStock,
    reorderThreshold: row.reorderThreshold,
    emergencyThreshold: row.emergencyThreshold,
    maxCapacity: row.maxCapacity,
    // Decimal → number, boundary-তেই (page.tsx-এর একই মন্তব্য)।
    costPerUnit: Number(row.costPerUnit),
    category: row.category,
    supplierId: row.supplierId,
    image: row.image,
    usedInRecipes: row._count.usedInRecipes,
    supplierName: row.supplier?.name ?? null,
  }));

  // ⚠️ ছাঁকাটা memory-তে, DB-তে নয় — "currentStock <= emergencyThreshold"
  // একটা column-বনাম-column তুলনা, যেটা Postgres indexed WHERE-এ করতে
  // পারে না (schema-র @@index([isActive])-এর মন্তব্য দ্রষ্টব্য)।
  const urgent = items.filter((item) => {
    const state = stockStateOf(item);
    return state === "emergency" || state === "out";
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/inventory"
        className="flex w-fit items-center gap-2 font-sora text-[14px] font-medium leading-none text-black/70 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to Inventory
      </Link>

      <div className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]">
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
            Emergency
          </h1>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
            {urgent.length} {urgent.length === 1 ? "item" : "items"}
          </span>
        </div>

        {urgent.length === 0 ? (
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            Nothing urgent right now — every ingredient is above its emergency threshold.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {urgent.map((item) => (
              <InventoryRow key={item.id} item={item} suppliers={suppliers} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
