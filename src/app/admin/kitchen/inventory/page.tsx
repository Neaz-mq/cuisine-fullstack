import Link from "next/link";
import { Calendar, Siren } from "lucide-react";
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
import InventoryToolbar from "@/app/admin/inventory/InventoryToolbar";
import InventoryRow, { type InventoryRowItem } from "@/app/admin/inventory/InventoryRow";
import Pagination from "@/app/admin/orders/Pagination";
import {
  KITCHEN_INVENTORY_API,
  KITCHEN_INVENTORY_PATH,
  loadKitchenInventory,
} from "./data";

export const metadata = { title: "Inventory" };

/**
 * src/app/admin/kitchen/inventory/page.tsx
 *
 * "Inventory" in the Figma kitchen sidebar — the same page as
 * /admin/inventory (Welcome Back header · search + status + Add Ingredient ·
 * Kitchen Inventory overview · emergency banner · one card per category with
 * Restock), rebuilt for the KITCHEN role.
 *
 * ── What the kitchen can and cannot do here ─────────────────────────────
 *
 * Behind the "kitchen" scope (layout.tsx one level up + requireStaff here).
 * KITCHEN does not hold "inventory", so nothing on this page calls
 * /api/admin/inventory/...; the modals are pointed at
 * /api/admin/kitchen/inventory/... instead (same handlers, lib/inventory-api.ts).
 *
 *   ✔ Add Ingredient            (Figma: Add Ingredient modal)
 *   ✔ Restock                   (Figma: Items Restock) — emails a Pending
 *                                order to the supplier; stock does NOT change
 *   ✔ View Emergency Items      (/admin/kitchen/inventory/emergency)
 *   ✔ Search, status filter, category filter, Export Report (no cost column)
 *   ✘ Edit an ingredient        — changes costs, thresholds, supplier
 *   ✘ Confirm a delivery        — that is what actually raises stock
 *
 * ⚠️ The list logic is a mirror of /admin/inventory/page.tsx — change one,
 * change the other.
 */

/** Rows per category card — Figma shows three. */
const ITEMS_PER_CATEGORY = 3;

/**
 * Category name -> its own page param in the URL (`p_proteins`, …). Each card
 * pages independently; with a single `page` param, moving "Proteins" to page 2
 * would drag "Dairy & Cheese" along.
 */
function categoryPageParam(name: string) {
  return `p_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export default async function KitchenInventoryPage({
  searchParams,
}: {
  /** Open Record: the per-category page params are built from data. */
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireStaff("kitchen");

  const params = await searchParams;
  const q = params.q?.trim().toLowerCase();
  const status = isInventoryStatusFilter(params.status)
    ? params.status
    : DEFAULT_INVENTORY_STATUS;

  const now = new Date();
  const { items, suppliers, currency } = await loadKitchenInventory();

  const visible = items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (status !== "all" && stockStateOf(item) !== status) return false;
    return true;
  });

  // Emergency AND out of stock — the same set as the Dashboard's "Emergency
  // Stock" card and the Emergency page, so the banner never says 2 while the
  // page it links to lists 3.
  const emergencyItems = items.filter((item) => {
    const state = stockStateOf(item);
    return state === "emergency" || state === "out";
  });

  /**
   * Group by category, in INVENTORY_CATEGORIES order (not alphabetical —
   * "Proteins" first is the kitchen's order and the designer's). Anything
   * outside the list goes last so it never disappears.
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
          <span className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3 font-sora text-[12px] leading-none text-black min-[480px]:h-11 min-[480px]:px-4 min-[480px]:text-[14px]">
            <Calendar
              className="h-4 w-4 shrink-0 text-black/70 min-[480px]:h-5 min-[480px]:w-5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {/* ⚠️ ৩২০px-এও পুরো তারিখ, বছর সহ — আগে সেখানে "Sep 2"
                দেখানো হতো, জায়গা বাঁচানোর জন্য।
                
                কিন্তু জায়গার টানটা ছিল **মাপের**, লেখার নয়। Figma-র
                ৩২০px frame (Frame 2147232352) বলছে: সারিটা ২৮৮ চওড়া,
                দুটো pill ১৩৯ করে, gap ১০ — আর pill-এর ভেতরে
                padding 12 + icon 20 + gap 8 + লেখা ৭৯ = ১৩১, অর্থাৎ
                ১৩৯-এ আঁটে। শর্ত একটাই: লেখাটা ১২px হতে হবে, ১৪ নয়।

                বছর বাদ দিলে "Sep 2" কোন বছরের তা বোঝার উপায় থাকে না —
                একটা report-এর পাতায় সেটা ঠিক ওই তথ্যটাই যেটা লাগে। */}
            {now.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>

          <ExportReportButton
            endpoint="/api/admin/kitchen/inventory/export"
            forwardParams={["q", "status"]}
            fallbackFilename="cuisine-kitchen-inventory.csv"
          />
        </div>
      </div>

      <InventoryToolbar
        status={status}
        suppliers={suppliers}
        currency={currency}
        apiBase={KITCHEN_INVENTORY_API}
      />

      {/* ⚠️ কার্ডের সংখ্যাগুলো **সব** সক্রিয় উপকরণ ধরে (`items`),
          ছাঁকা তালিকা (`visible`) নয় — "৩টে জিনিস ফুরিয়ে গেছে" সত্যটা
          search box-এ কী লেখা আছে তার উপর নির্ভর করা উচিত নয়। */}
      {/* ⚠️ `items` এখানে **সব** সক্রিয় উপকরণ — উপরের search/status
          ছাঁকনি এদের বদলায় না। ইচ্ছাকৃত: "৩টে জিনিস ফুরিয়ে গেছে"
          সত্যটা search box-এ কী লেখা আছে তার উপর নির্ভর করা উচিত নয়।
          কার্ডের নিজের `cat` ছাঁকনিটা আলাদা, আর সেটাও নিচের তালিকা
          ছোঁয় না — শুধু চারটে সংখ্যার পরিধি ঠিক করে। */}
      <InventoryOverviewCards items={items} category={params.cat ?? "all"} />

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
            href={`${KITCHEN_INVENTORY_PATH}/emergency`}
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
        groups.map((group) => {
          /**
           * ⚠️ ছাঁটাইটা এখানেই, render-এর ঠিক আগে — কারণ `groups`
           * তৈরি হওয়ার সময় জানা যায় না কোন ভাগে ব্যবহারকারী কোন
           * page-এ আছেন, আর সব ভাগের জন্য আলাদা করে হিসাব করলে
           * উপরের `groups` গড়ার অংশটা অকারণে জটিল হতো।
           */
          const total = group.items.length;
          const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_CATEGORY));
          const pageParam = categoryPageParam(group.name);

          /**
           * ⚠️ URL থেকে আসা সংখ্যাটা যাচাই করে নেওয়া হচ্ছে। `?p_proteins=99`
           * বা `=abc` হাতে লিখলে (বা কেউ পুরনো bookmark খুললে, যেখানে
           * তখন বেশি জিনিস ছিল) `Number()` দেবে 99 বা NaN, আর slice
           * ফেরত দিত খালি তালিকা — ব্যবহারকারী দেখতেন একটা শূন্য কার্ড
           * আর বুঝতেন না কেন। তাই সীমার বাইরে গেলে ১ নম্বরে ফিরিয়ে আনা।
           */
          const requested = Number(params[pageParam]);
          const page =
            Number.isInteger(requested) && requested >= 1 && requested <= totalPages
              ? requested
              : 1;

          const start = (page - 1) * ITEMS_PER_CATEGORY;
          const pageItems = group.items.slice(start, start + ITEMS_PER_CATEGORY);

          return (
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
              {pageItems.map((item) => (
                <InventoryRow
                  key={item.id}
                  item={item}
                  suppliers={suppliers}
                  currency={currency}
                  apiBase={KITCHEN_INVENTORY_API}
                  canEdit={false}
                />
              ))}
            </div>

            {/**
             * ⚠️ `totalPages > 1` হলে তবেই পুরো সারিটা — Pagination
             * নিজেই এক page হলে `null` ফেরায়, কিন্তু বাঁ দিকের
             * "Showing …" লেখাটা তখনো থাকত। তিনটে বা তার কম জিনিসের
             * ভাগে "Showing 1–2 of 2" পড়ার কিছু নেই, আর উপরের
             * pill-এ সংখ্যাটা এমনিতেই আছে।
             */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]"
                    aria-hidden="true"
                  />
                  Showing{" "}
                  <span className="font-semibold text-black">
                    {start + 1}–{start + pageItems.length}
                  </span>{" "}
                  of <span className="font-semibold text-black">{total}</span>{" "}
                  {total === 1 ? "Item" : "Items"}
                </p>

                {/**
                 * ⚠️ `pageParam` — প্রতিটা ভাগের নিজের নাম। Pagination
                 * বাকি সব param অপরিবর্তিত রেখে শুধু এটাই বদলায়, তাই
                 * "Proteins"-এর ২ নম্বরে গেলে "Vegetables" যেখানে ছিল
                 * সেখানেই থাকে, আর `q`/`status` ছাঁকনিও হারায় না।
                 */}
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  searchParams={params}
                  basePath={KITCHEN_INVENTORY_PATH}
                  pageParam={pageParam}
                />
              </div>
            )}
          </div>
          );
        })
      )}
    </div>
  );
}
