"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { toast } from "react-toastify";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import FilterMenu from "@/components/admin/FilterMenu";
import LocalPagination from "@/components/admin/LocalPagination";
import {
  compareMenuItems,
  DEFAULT_MENU_SORT,
  MENU_SORT_OPTIONS,
  type MenuSort,
} from "@/lib/menu-sort";
import MenuItemFormModal from "./MenuItemFormModal";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/** Figma-র ছোট তথ্য-pill: h 36, radius 100, padding 10px 12px, Sora 12px। */
const INFO_PILL =
  "flex h-9 max-w-full items-center gap-1 rounded-full px-3 font-sora text-[12px] leading-none";

/** Figma: কলামের label — Sora 400 14px, Black/70। */
const COLUMN_LABEL = "font-sora text-[13px] font-normal leading-none text-black/70 md:text-[14px]";

/** পাঁচটার বেশি হলে pagination — Figma-র "Showing 1 to 5 of …"। */
const PAGE_SIZE = 5;

/**
 * "499 Kcal · 20 min" — যেটুকু বসানো আছে কেবল সেটুকুই, আর কিছুই না
 * থাকলে `null`।
 *
 * ⚠️ `?? 0` করে "0 Kcal" দেখানো হয় না। শূন্য একটা দাবি ("এই খাবারে
 * কোনো ক্যালরি নেই"), আর সেটা প্রায় কখনোই সত্যি নয় — সত্যিটা হলো
 * কেউ এখনো সংখ্যাটা বসায়নি।
 */
function nutritionLabel(item: MenuSectionItem): string | null {
  const parts: string[] = [];
  if (item.calories !== null) parts.push(`${item.calories} Kcal`);
  if (item.prepTimeMinutes !== null) parts.push(`${item.prepTimeMinutes} min`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export type MenuSectionItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  /** ISO string — Date নয়, কারণ server → client-এ plain object যায়। */
  createdAt: string;
  /** দাম যেভাবে দেখানো হবে, মুদ্রা সহ — server-এ formatAmount দিয়ে তৈরি। */
  priceLabel: string;

  // ── Figma-র "Add Item" modal-এর মাঠগুলো ──────────────────────────
  calories: number | null;
  fatGrams: number | null;
  proteinGrams: number | null;
  carbGrams: number | null;
  prepTimeMinutes: number | null;
  /** খদ্দেরকে দেখানোর মতো উপকরণের নাম — recipe নয়। */
  ingredientTags: string[];
  foodStatus: string | null;
};

/**
 * src/app/admin/menu/MenuCategorySection.tsx
 *
 * Figma Frame 2147236299 — একটা শ্রেণির কার্ড।
 *
 *   কার্ড              column, padding 30, gap 20, radius 20, সাদা
 *   ├ মাথা (2147236238) row, space-between, h 40
 *   │   শ্রেণির নাম     Frank Ruhl 600 30px
 *   │   pill            h 40, padding 12, BG #F9F6F3, radius 100
 *   ├ তালিকা (…295)     column, gap 16
 *   │   └ সারি (…297)   row, space-between, padding 16, gap 27,
 *   │                   h 110, BG #F9F6F3, radius 16
 *   └ pager (…2469)     row, space-between, h 34
 *
 * সারির ভেতরে তিনটে অংশ:
 *
 *   Frame 2147236287  ছবি 78×78 (radius 12) + নাম/বিবরণ (gap 16)
 *   Frame 2147236288  চারটে কলাম, gap 18 — label + মান
 *   Frame 2147236283  Edit (86×50 outline) + Delete (86×50 #D72A37)
 *
 * ── চারটে কলামে কী বসেছে, আর কেন ────────────────────────────────────
 *
 * Figma-তে কলামগুলো: Reg Price · Nutrition & Time · Ingredients · Status।
 *
 * ⚠️ "Nutrition & Time" বসানো যায়নি — `MenuItem`-এ ক্যালরি বা রান্নার
 * সময়ের কোনো মাঠই নেই, আর দুটো কলাম যোগ করলে সেগুলো ভরার কোনো উপায়
 * থাকত না (form-এ ঘর নেই, API-তে মাঠ নেই), অর্থাৎ প্রতিটা সারিতে
 * চিরকাল একটা "—" বসে থাকত। Categories-এর "Featured" কার্ডেও ঠিক এই
 * একই সিদ্ধান্ত নেওয়া হয়েছে, একই কারণে।
 *
 * তার বদলে ওই ঘরে বসেছে **Food Cost** — এক একক বানাতে কাঁচামালের
 * খরচ। জিনিসটা বানানো নয়, ইতিমধ্যেই আছে: recipe (MenuItemIngredient)
 * × InventoryItem.costPerUnit, আর হিসাবটা `lib/menu-profitability.ts`
 * করে (Insights পাতা এটাই ব্যবহার করে)। দামের ঠিক পাশে বসায় প্রশ্নটা
 * এক নজরেই মেলে: "এটা বেচে কত থাকছে"।
 *
 * "Ingredients" কলামটা Figma-রই, আর ওটার ডেটাও আসল — pill-এ উপকরণের
 * সংখ্যা, chevron চাপলে নামগুলো নিচে খোলে (Figma-র chevron-টা ঠিক
 * এটাই ইঙ্গিত করে)।
 *
 * "Status" pill-টা **চাপা যায়** — Available ↔ Unavailable। পুরনো
 * পাতার `AvailabilityToggle` এই কাজটাই করত; নকশায় ওটার আলাদা কোনো
 * জায়গা নেই, আর একটা pill যেটা অবস্থাও দেখায় আবার বদলায়ও, সেটা
 * দুটোর চেয়ে সরল।
 */
export default function MenuCategorySection({
  categoryId,
  categoryName,
  items,
  categories,
  currency,
}: {
  categoryId: string;
  categoryName: string;
  items: MenuSectionItem[];
  /** সব শ্রেণি — সম্পাদনার modal-এর Category dropdown-এর জন্য। */
  categories: readonly { value: string; label: string }[];
  currency?: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<MenuSort>(DEFAULT_MENU_SORT);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuSectionItem | null>(null);
  const [confirming, setConfirming] = useState<MenuSectionItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // ⚠️ `[...items]` — `sort()` জায়গায় বসেই সাজায়, তাই prop-এর array-টা
  // সরাসরি সাজালে সেটাই বদলে যেত। lib/menu-sort.ts-এ বিস্তারিত।
  const sorted = [...items].sort(compareMenuItems(sort));

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // ছাঁকনি বা সাজানো বদলে তালিকা ছোট হয়ে গেলে চলতি page আর থাকতে পারে
  // না — তখন শেষ page-টাই ধরা হয়, নাহলে একটা খালি কার্ড দেখা যেত।
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  function handleToggleAvailability(item: MenuSectionItem) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/menu-items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: !item.isAvailable }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Couldn't update availability.");
        }
        router.refresh();
      } catch (error) {
        // ⚠️ পুরনো AvailabilityToggle আশাবাদী ছিল — চাপার সাথে সাথেই রঙ
        // বদলাত, আর ব্যর্থ হলে নীরবে ফিরে যেত। এখানে server-এর উত্তর
        // আসার পরেই বদলায় (router.refresh), তাই ব্যর্থতা লুকিয়ে থাকে না।
        toast.error(error instanceof Error ? error.message : "Couldn't update availability.");
      }
    });
  }

  function handleDelete(item: MenuSectionItem) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/menu-items/${item.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to delete");
        }
        setConfirming(null);
        router.refresh();
        toast.success(`"${item.title}" deleted.`);
      } catch (error) {
        setConfirming(null);
        // route-টা 409-এ বলে "এই পদের পুরনো order আছে, unavailable করে
        // দিন" — সেই পরামর্শটাই দেখা দরকার।
        toast.error(error instanceof Error ? error.message : "Couldn't delete the item.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-[20px] bg-white p-4 min-[480px]:p-5 md:p-[30px]">
      {/* Frame 2147236238: row, space-between, উচ্চতা 40। */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="min-w-0 truncate font-frank-ruhl text-[22px] font-semibold leading-none text-black min-[480px]:text-[24px] xl:text-[30px]">
          {categoryName}
        </h2>

        {/* Frame 2147236234: pill h 40, BG #F9F6F3 — কেন period নয়,
            lib/menu-sort.ts-এ ব্যাখ্যা। */}
        {items.length > 1 && (
          <FilterMenu
            value={sort}
            options={MENU_SORT_OPTIONS}
            onSelect={(next) => {
              setSort(next);
              // সাজানো বদলালে আবার প্রথম page — নাহলে ৩ নম্বর page-এ
              // থাকা অবস্থায় সাজানো বদলে সম্পূর্ণ অন্য পাঁচটা পদ
              // চোখের সামনে এসে পড়ত, আর কেন সেটা বোঝা যেত না।
              setPage(1);
            }}
            ariaLabel={`Sort ${categoryName}`}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[12px] leading-[1.7] text-black/70">
          No items in this category yet.
        </p>
      ) : (
        <>
          {/* Frame 2147236295: column, gap 16। */}
          <div className="flex flex-col gap-4">
            {visible.map((item) => (
              /**
               * ⚠️ ১০২৪-এর নিচে সারিটা column। Figma-র row-টা 999px
               * চওড়ায় আঁকা — ছবি + লেখা + চারটে কলাম + দুটো বোতাম এক
               * সারিতে ধরাতে অন্তত ৯০০px লাগে। ট্যাবলেটেও সেটা নেই,
               * তাই ভাঙাটা `lg:` থেকে, `md:` থেকে নয়।
               */
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-[27px]"
              >
                {/* Frame 2147236287: row, gap 16। */}
                <div className="flex min-w-0 items-center gap-3 md:gap-4 lg:w-[221px] lg:shrink-0">
                  {/* Frame 2147225236: 78×78, radius 12। */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white md:h-[78px] md:w-[78px]">
                    {item.imageUrl ? (
                      /**
                       * ⚠️ `unoptimized` — reviews পাতার মতোই। পদের ছবি
                       * Supabase Storage বা Cloudinary যেকোনোটা থেকে আসতে
                       * পারে, আর পুরনো কোনো সারিতে অন্য host-ও থেকে যেতে
                       * পারে; optimizer-এ গেলে remotePatterns-এ না থাকা
                       * host-এ পুরো পাতাটাই 400 দিয়ে ভাঙে, অথচ এখানে
                       * ছবিটা 78px-এর একটা thumbnail।
                       */
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 78px, 56px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed
                          className="h-5 w-5 text-black/20 md:h-6 md:w-6"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>

                  {/* Frame 2147236286: column, gap 8। */}
                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="min-w-0 font-frank-ruhl text-[17px] font-medium leading-[1.25] text-black max-lg:line-clamp-2 lg:truncate lg:text-[20px] lg:leading-[1.2]">
                      {item.title}
                    </h3>
                    {/* নকশায় ঘরটা 40px উঁচু = ঠিক দুই লাইন (12px × 170%)। */}
                    <p className="line-clamp-2 font-sora text-[12px] font-normal leading-[1.7] text-black/70">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/**
                 * Frame 2147236288: row, gap 18, চারটে কলাম।
                 *
                 * ⚠️ ৬৪০-এর নিচে দুই কলামের grid, তার উপরে চারটে পাশাপাশি।
                 * ৩২০px-এ চারটে কলাম মানে প্রতিটার ভাগে ~৪০px — pill-এর
                 * ভেতরের লেখাই আঁটত না।
                 */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 min-[640px]:grid-cols-4 lg:w-[438px] lg:shrink-0 lg:gap-x-[18px]">
                  <div className="flex min-w-0 flex-col gap-3">
                    <span className={COLUMN_LABEL}>Reg Price</span>
                    <span className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
                      {item.priceLabel}
                    </span>
                  </div>

                  {/**
                   * Figma-র "Nutrition & Time" — pill-এ "499 Kcal · 20 min"।
                   *
                   * ⚠️ আগের দফায় এই ঘরে "Food Cost" বসানো হয়েছিল, কারণ
                   * তখন `MenuItem`-এ ক্যালরি বা সময়ের কোনো মাঠই ছিল না।
                   * এখন Add Item modal-এর সাথে ওগুলো যোগ হয়েছে, তাই
                   * নকশার আসল কলামটাই ফিরিয়ে আনা গেল। Food cost এখনো
                   * হিসাব হয় — Insights পাতায়, যেখানে margin-এর পাশে
                   * ওটার আসল জায়গা।
                   *
                   * দুটোর একটাও বসানো না থাকলে "Not set" — "0 Kcal" নয়,
                   * কারণ শূন্য একটা উত্তর, আর এখানে উত্তরটা জানা নেই।
                   */}
                  <div className="flex min-w-0 flex-col gap-3">
                    <span className={COLUMN_LABEL}>Nutrition &amp; Time</span>
                    <span
                      className={`${INFO_PILL} bg-white ${
                        nutritionLabel(item) ? "text-black" : "text-black/40"
                      }`}
                      title={
                        nutritionLabel(item)
                          ? "Calories and preparation time"
                          : "No nutrition or time set for this item yet"
                      }
                    >
                      <span className="truncate">{nutritionLabel(item) ?? "Not set"}</span>
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3">
                    <span className={COLUMN_LABEL}>Ingredients</span>
                    {/**
                     * ⚠️ এগুলো `ingredientTags` — Add Item modal-এ হাতে
                     * লেখা chip, খদ্দেরকে দেখানোর মতো তালিকা। পদটার
                     * **recipe** (কোন InventoryItem কতটা লাগে) আলাদা
                     * জিনিস, আর সেটা এখনো /admin/menu/<id>/edit-এ।
                     *
                     * ⚠️ তালিকা খালি হলেও pill-টা বোতামই থাকে —
                     * নিষ্ক্রিয় করে দিলে যে পদগুলোয় এখনো কিছু বসানো
                     * হয়নি ঠিক সেগুলোতেই recipe-র লিঙ্কটা পৌঁছত না।
                     */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => (prev === item.id ? null : item.id))
                      }
                      aria-expanded={expanded === item.id}
                      className={`${INFO_PILL} bg-white transition-colors hover:bg-black/[0.04] ${
                        item.ingredientTags.length === 0 ? "text-black/40" : "text-black"
                      } ${FOCUS_RING}`}
                    >
                      <span className="truncate">
                        {item.ingredientTags.length === 0
                          ? "None"
                          : `${item.ingredientTags.length} ${
                              item.ingredientTags.length === 1 ? "item" : "items"
                            }`}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          expanded === item.id ? "rotate-180" : ""
                        }`}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3">
                    <span className={COLUMN_LABEL}>Status</span>
                    {/**
                     * Figma: BG #E8FFEC, লেখা #0ECF00। বন্ধ অবস্থার কোনো
                     * রঙ নকশায় নেই, তাই ঘরের নিজের বিপদ-লাল (#D72A37)
                     * আর তার হালকা পটভূমি — Categories-এর "Unavailable"
                     * চিহ্নে হুবহু এই দুটোই।
                     */}
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(item)}
                      disabled={isPending}
                      aria-label={`Mark ${item.title} as ${
                        item.isAvailable ? "unavailable" : "available"
                      }`}
                      className={`${INFO_PILL} transition-opacity hover:opacity-80 disabled:opacity-50 ${
                        item.isAvailable
                          ? "bg-[#E8FFEC] text-[#0ECF00]"
                          : "bg-[#FAE7EC] text-[#D72A37]"
                      } ${FOCUS_RING}`}
                    >
                      <span className="truncate">
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </span>
                    </button>
                  </div>

                  {/**
                   * উপকরণের তালিকা — pill-এর chevron চাপলে খোলে।
                   * grid-এর পুরো প্রস্থ জুড়ে, তাই লম্বা নামও আঁটে।
                   *
                   * ⚠️ শেষের "Edit recipe" লিঙ্কটা গুরুত্বপূর্ণ, আর
                   * এটা উপরের chip-গুলোর সাথে **এক জিনিস নয়**। recipe
                   * (উপকরণের পরিমাণ, যা দিয়ে stock কাটা আর food cost
                   * হয়) modal-এ নেই — দুটো আলাদা save একই কার্ডে বসত,
                   * MenuItemFormModal-এ ব্যাখ্যা — তাই ওটা এখনো
                   * /admin/menu/<id>/edit পাতাতেই। এই লিঙ্কটা না দিলে
                   * নকশা বদলের পর ওই পাতায় পৌঁছনোর আর কোনো উপায়
                   * থাকত না, আর একটা কাজ নীরবে হারিয়ে যেত।
                   */}
                  {expanded === item.id && (
                    <div className="col-span-2 flex flex-wrap items-center gap-2 min-[640px]:col-span-4">
                      {item.ingredientTags.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-white px-3 py-1.5 font-sora text-[11px] leading-none text-black/70"
                        >
                          {name}
                        </span>
                      ))}
                      <Link
                        href={`/admin/menu/${item.id}/edit`}
                        className={`rounded-full px-3 py-1.5 font-sora text-[11px] font-medium leading-none text-[#FF7100] underline-offset-2 hover:underline ${FOCUS_RING}`}
                      >
                        Edit recipe
                      </Link>
                    </div>
                  )}
                </div>

                {/**
                 * Frame 2147236283: row, gap 12।
                 *
                 * ⚠️ ১০২৪-এর নিচে দুটো বোতাম `flex-1` — সারিটা তখন
                 * column, তাই স্থির ৮৬px রাখলে ওরা বাঁ দিকে জড়ো হয়ে
                 * থাকত আর ডানে একটা অকারণ ফাঁকা জায়গা পড়ে থাকত।
                 * উচ্চতাও ৫০ → ৪০ আর লেখা ১৬ → ১৪, মোবাইলের বাকি সব
                 * বোতামের মাপে।
                 */}
                <div className="flex items-center gap-2 lg:shrink-0 lg:gap-3">
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className={`flex h-10 flex-1 items-center justify-center rounded-full border border-black font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white lg:h-[50px] lg:w-[86px] lg:flex-none lg:text-[16px] ${FOCUS_RING}`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirming(item)}
                    disabled={isPending}
                    className={`flex h-10 flex-1 items-center justify-center rounded-full bg-[#D72A37] font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50 lg:h-[50px] lg:w-[86px] lg:flex-none lg:text-[16px] ${FOCUS_RING}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Frame 2147232469 — বাঁয়ে "Showing …", ডানে page বোতাম। */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 font-sora text-[12px] leading-[15px] text-[#121212]/60">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9540]"
                  aria-hidden="true"
                />
                Showing{" "}
                <span className="font-semibold text-black">
                  {start + 1}–{start + visible.length}
                </span>{" "}
                of <span className="font-semibold text-black">{sorted.length}</span>{" "}
                {sorted.length === 1 ? "Item" : "Items"}
              </p>

              <LocalPagination
                currentPage={safePage}
                totalPages={totalPages}
                onChange={setPage}
                label={`${categoryName} pagination`}
              />
            </div>
          )}
        </>
      )}

      {editing && (
        <MenuItemFormModal
          open
          onClose={() => setEditing(null)}
          item={{
            id: editing.id,
            title: editing.title,
            description: editing.description,
            price: editing.price,
            imageUrl: editing.imageUrl,
            // পদটা এই সারিরই ভেতরে, তাই শ্রেণিটা নিশ্চিতভাবে এটাই।
            categoryId,
            isAvailable: editing.isAvailable,
            calories: editing.calories,
            fatGrams: editing.fatGrams,
            proteinGrams: editing.proteinGrams,
            carbGrams: editing.carbGrams,
            ingredientTags: editing.ingredientTags,
            foodStatus: editing.foodStatus,
            prepTimeMinutes: editing.prepTimeMinutes,
          }}
          categories={categories}
          currency={currency}
        />
      )}

      {/**
       * ⚠️ `confirm()` নয়, ঘরের নিজের ConfirmDialog — পুরনো
       * DeleteMenuItemButton-এ browser-এর `confirm()` ছিল, যেটা নকশার
       * বাইরে, style করা যায় না, আর তার ডিফল্ট focus থাকে OK-তে।
       */}
      <ConfirmDialog
        open={confirming !== null}
        title={`Delete "${confirming?.title ?? ""}"?`}
        message="This removes the item from the menu. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        pending={isPending}
        onConfirm={() => confirming && handleDelete(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
