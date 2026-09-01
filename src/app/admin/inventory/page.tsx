import Link from "next/link";
import { Calendar, Siren } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import InventoryOverviewCards from "@/components/admin/InventoryOverviewCards";
import {
  DEFAULT_INVENTORY_STATUS,
  INVENTORY_CATEGORIES,
  UNCATEGORISED,
  isInventoryStatusFilter,
  stockStateOf,
} from "@/lib/inventory-status";
import InventoryToolbar from "./InventoryToolbar";
import InventoryRow, { type InventoryRowItem } from "./InventoryRow";

export const metadata = { title: "Inventory" };

/**
 * src/app/admin/inventory/page.tsx
 *
 * ⚠️ এই পাতাটা পুরো নতুন করে লেখা। আগেরটা ছিল একটা সাদামাটা HTML
 * table (`AddInventoryItemForm` + `InventoryItemActions`) — কাজ করত,
 * কিন্তু নকশার সাথে কোনো সম্পর্ক ছিল না। ওই দুটো ফাইল মুছে ফেলা
 * হয়েছে; তাদের কাজ এখন IngredientFormModal আর InventoryRowActions-এ।
 *
 * ── কেন সব সারি এক query-তে আসে ─────────────────────────────────────
 *
 * এখানে page-ভিত্তিক query নেই, পুরো সক্রিয় তালিকাটাই আসে। দুটো কারণ।
 *
 * এক, status ছাঁকনিটা DB-তে করা **যায় না**: "currentStock <=
 * reorderThreshold" একটা column-বনাম-column তুলনা, যেটা Postgres
 * indexed WHERE-এ করতে পারে না (schema-র @@index([isActive])-এর
 * মন্তব্যে এই tradeoff আগে থেকেই লেখা)। তাই ছাঁকাটা memory-তেই হতে
 * হবে, আর তার জন্য সব সারি দরকার।
 *
 * দুই, Overview কার্ডের সংখ্যাগুলোরও পুরো তালিকা লাগে — "কতগুলো
 * জিনিস কম আছে" প্রশ্নের উত্তর একটা page-এর দশটা সারি থেকে দেওয়া
 * যায় না।
 *
 * একটা রেস্তোরাঁর উপকরণ-তালিকা কয়েকশোর বেশি হয় না, তাই এটা নিরাপদ।
 * হাজার ছাড়ালে সংখ্যাগুলো আলাদা aggregate query-তে সরাতে হবে।
 *
 * ⚠️ Figma-তে প্রতিটা শ্রেণি-ভাগের নিচে আলাদা pagination আঁকা। বসানো
 * হয়নি: N-টা ভাগের N-টা স্বাধীন page মানে URL-এ N-টা আলাদা param,
 * আর ভাগগুলো তৈরি হয় ডেটা থেকে — অর্থাৎ নামগুলো আগে থেকে জানা নেই।
 * ভাগগুলো এমনিতেই ছোট (একটা রেস্তোরাঁয় ১০-১৫ রকম protein), তাই
 * প্রতিটার নিচে "N items" লেখা যথেষ্ট।
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  // layout-এও "inventory" scope-এর গেট আছে; এখানে session লাগে শুধু
  // শিরোনামের নামটার জন্য।
  const session = await requireStaff("inventory");

  const params = await searchParams;
  const q = params.q?.trim().toLowerCase();
  const status = isInventoryStatusFilter(params.status)
    ? params.status
    : DEFAULT_INVENTORY_STATUS;

  const now = new Date();

  const [rows, suppliers] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
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
        // Figma-র "Used in 8 menu items" — recipe-এ কতগুলো menu item
        // এই উপকরণটা ব্যবহার করে।
        _count: { select: { usedInRecipes: true } },
      },
    }),
    // modal-গুলোর dropdown-এর জন্য — client-এ আলাদা fetch করার চেয়ে
    // এখানেই তুলে prop হিসেবে পাঠানো সস্তা।
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
    // ⚠️ Decimal → number, boundary-তেই। JSON.stringify একটা Decimal-কে
    // string বানায় ("30"), আর modal সেটাকে number ধরে নেয়। খাবারের
    // দামের হিসাবে এটা কোনো যোগফলে ঢোকে না, শুধু দেখানো ও সম্পাদনা —
    // তাই float এখানে নিরাপদ।
    costPerUnit: Number(row.costPerUnit),
    category: row.category,
    supplierId: row.supplierId,
    image: row.image,
    usedInRecipes: row._count.usedInRecipes,
    supplierName: row.supplier?.name ?? null,
  }));

  const visible = items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (status !== "all" && stockStateOf(item) !== status) return false;
    return true;
  });

  const emergencyItems = items.filter((item) => stockStateOf(item) === "emergency");

  /**
   * শ্রেণি ধরে ভাগ।
   *
   * ক্রমটা INVENTORY_CATEGORIES-এর, বর্ণানুক্রমিক নয় — রান্নাঘরে
   * "Proteins" আগে আসে, "Spices" পরে, আর সেটা designer-এর ক্রমও।
   * তালিকার বাইরের কোনো শ্রেণি থাকলে (পুরনো ডেটা, বা তালিকা থেকে
   * বাদ দেওয়া নাম) সেটা শেষে যোগ হয় — হারিয়ে যায় না।
   */
  const groups: { name: string; items: InventoryRowItem[] }[] = [];
  const seen = new Set<string>();
  for (const category of INVENTORY_CATEGORIES) {
    const inCategory = visible.filter((item) => item.category === category);
    seen.add(category);
    if (inCategory.length > 0) groups.push({ name: category, items: inCategory });
  }
  const leftovers = visible.filter((item) => !item.category || !seen.has(item.category));
  if (leftovers.length > 0) groups.push({ name: UNCATEGORISED, items: leftovers });

  return (
    <div className="flex flex-col gap-6">
      {/* --- শিরোনাম সারি --- বাকি admin পাতাগুলোর হুবহু একই গড়ন। */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="min-w-0 font-sora text-[22px] font-semibold leading-tight tracking-normal text-black/70 md:leading-none lg:text-[26px] xl:text-[30px]">
          Welcome Back,{" "}
          <span className="bg-gradient-to-r from-[#FF7100] to-[#FF1CA4] bg-clip-text text-transparent">
            {session.user.name ?? "there"}!
          </span>
        </h1>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:w-auto md:flex-nowrap md:justify-start">
          <span className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 font-sora text-[14px] leading-none text-black">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {/* ⚠️ `sm:` নয় — globals.css-এ sm = 320px, তাই `sm:hidden`
                মানে কার্যত সবসময় লুকানো। */}
            <span className="min-[480px]:hidden">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="hidden min-[480px]:inline">
              {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </span>

          <ExportReportButton
            endpoint="/api/admin/inventory/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-inventory.csv"
          />
        </div>
      </div>

      <InventoryToolbar status={status} suppliers={suppliers} />

      {/* ⚠️ কার্ডের সংখ্যাগুলো **সব** সক্রিয় উপকরণ ধরে (`items`),
          ছাঁকা তালিকা (`visible`) নয় — "৩টে জিনিস ফুরিয়ে গেছে" সত্যটা
          search box-এ কী লেখা আছে তার উপর নির্ভর করা উচিত নয়। */}
      <InventoryOverviewCards items={items} />

      {/* --- জরুরি সতর্কবার্তা --- Figma Frame 2147236302।
          ⚠️ কেবল যখন সত্যিই কিছু জরুরি — শূন্য অবস্থায় একটা লাল
          banner রোজ দেখতে দেখতে মানুষ সেটা দেখাই বন্ধ করে দেয়, আর
          তখন সত্যিকারের জরুরি অবস্থাতেও চোখে পড়ে না। */}
      {emergencyItems.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-[20px] bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] p-5 md:flex-row md:items-center md:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {/* Frame: 46×46, BG #FFFFFF, radius 12। */}
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[12px] bg-white">
              <Siren className="h-5 w-5 text-black" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-frank-ruhl text-[18px] font-semibold leading-[1.2] text-white">
                {emergencyItems.length}{" "}
                {emergencyItems.length === 1 ? "ingredient needs" : "ingredients need"} urgent
                restocking
              </p>
              <p className="truncate font-sora text-[12px] leading-[1.7] text-white/80">
                {emergencyItems
                  .slice(0, 2)
                  .map((item) => item.name)
                  .join(" and ")}
                {emergencyItems.length > 2 && ` and ${emergencyItems.length - 2} more`} are almost
                out.
              </p>
            </div>
          </div>

          <Link
            href="/admin/inventory/emergency"
            className="flex h-[46px] shrink-0 items-center justify-center rounded-full bg-white px-5 font-sora text-[14px] font-medium leading-none text-black transition-opacity hover:opacity-90"
          >
            View Emergency Items
          </Link>
        </div>
      )}

      {/* --- শ্রেণি-ভাগগুলো --- */}
      {groups.length === 0 ? (
        <div className="rounded-[20px] bg-white p-5 md:p-[30px]">
          <p className="font-sora text-[14px] leading-[1.7] text-black/70">
            {q || status !== "all"
              ? "No ingredients match this search."
              : "No ingredients yet. Use “Add Ingredient” to create the first one."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <div
            key={group.name}
            className="flex flex-col gap-6 rounded-[20px] bg-white p-5 md:p-[30px]"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black">
                {group.name}
              </h2>
              {/* ⚠️ Figma-তে এখানে একটা "All ⌄" dropdown — উপরের "All
                  Statuses"-এর ঠিক একই ছাঁকনি। প্রতিটা ভাগে আলাদা
                  ছাঁকনি রাখলে ব্যবহারকারীকে ভাবতে হতো "উপরেরটার সাথে
                  এর সম্পর্ক কী", আর একটা বদলে অন্যটা না বদলালে সেটা
                  ভাঙা মনে হতো। তাই pill-এর গড়ন রেখে ভেতরে সংখ্যা। */}
              <span className="flex h-10 shrink-0 items-center rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] font-normal leading-none text-black">
                {group.items.length} {group.items.length === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {group.items.map((item) => (
                <InventoryRow key={item.id} item={item} suppliers={suppliers} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
