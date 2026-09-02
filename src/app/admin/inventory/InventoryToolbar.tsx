"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu, { FILTER_FOCUS_RING } from "@/components/admin/FilterMenu";
import {
  DEFAULT_INVENTORY_STATUS,
  INVENTORY_STATUS_OPTIONS,
  type InventoryStatusFilter,
} from "@/lib/inventory-status";
import IngredientFormModal, { type SupplierOption } from "./IngredientFormModal";

/**
 * src/app/admin/inventory/InventoryToolbar.tsx
 *
 * Figma Frame 2147236297: সার্চ ঘর (flex-grow) + "All Statuses ⌄" +
 * "+ Add Ingredient", সবার উচ্চতা 50।
 *
 * ⚠️ Figma-তে search-এর placeholder "Search by Order ID" — কিন্তু এই
 * পাতায় কোনো order নেই, উপকরণ আছে। ওটা Orders পাতা থেকে frame copy
 * করার সময় রয়ে যাওয়া, তাই লেখাটা বদলানো হয়েছে।
 */
export default function InventoryToolbar({
  status,
  suppliers,
}: {
  status: InventoryStatusFilter;
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * URL বাইরে থেকে বদলালে (back/forward, ছাঁকনি) ঘরটাও মিলিয়ে নেওয়া।
   *
   * ⚠️ এটা একটা `useEffect`-এ ছিল, আর lint ঠিকই ধরেছে
   * (`react-hooks/set-state-in-effect`): effect-এর শরীরে সরাসরি
   * setState মানে React একবার পুরনো মান নিয়ে render করে, তারপর
   * setState দেখে আবার — একটা অপ্রয়োজনীয় cascading render, আর
   * এক ফ্রেমের জন্য ঘরে ভুল লেখা।
   *
   * এটা React-এর নিজের "prop বদলালে state ঠিক করে নেওয়া" প্যাটার্ন
   * (react.dev/learn/you-might-not-need-an-effect): render চলাকালীন
   * তুলনা করে setState — React তখন DOM-এ কিছু আঁকার **আগেই** আবার
   * render করে, তাই বাড়তি commit হয় না।
   */
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // এই পাতার নিজের parameter — `page` ইচ্ছাকৃতভাবে বাদ, কারণ ছাঁকনি
    // বদলে ফলাফল কমে গেলে ৫ নম্বর page-এ খালি পর্দা আসত।
    ["q", "status"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  /**
   * টাইপ করার সময় প্রতিটা অক্ষরে নয়, থামার ৩০০ms পরে — নাহলে প্রতিটা
   * keystroke-এ একটা করে server round-trip হতো।
   *
   * ⚠️ শর্তটা এখন সরাসরি `query === urlQuery` — আগের `requestedRef`
   * লাগে না। ঘরের লেখা আর URL এক মানে push করার কিছু নেই, তা সেটা
   * ব্যবহারকারী টাইপ করে মিলিয়েছেন নাকি back বোতাম মিলিয়ে দিয়েছে।
   * একটা ref কম মানে render-এর সময় ref বদলানোর প্রশ্নও নেই।
   */
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => push({ q: query || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      {/* Figma "Fill": উচ্চতা 50, padding 16, gap 8, radius 100, সাদা। */}
      <label className="flex h-[50px] min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-4 focus-within:[outline:2px_solid_#FF9540] focus-within:[outline-offset:-2px]">
        <Search className="h-5 w-5 shrink-0 text-black/70" strokeWidth={1.5} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by ingredient name…"
          aria-label="Search inventory"
          className="min-w-0 flex-1 bg-transparent font-sora text-[15px] leading-none text-black placeholder:text-black/70 focus:outline-none md:text-[16px]"
        />
      </label>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* ⚠️ `surface="white"` — এই pill-টা cream পাতার উপরে বসে,
            search ঘর আর বোতামের মাঝখানে। ডিফল্ট cream রঙে ওটা
            পটভূমির সাথে মিশে যেত (FilterMenu.tsx-এর `surface` prop)। */}
        <FilterMenu
          surface="white"
          value={status}
          options={INVENTORY_STATUS_OPTIONS}
          onSelect={(next) => push({ status: next === DEFAULT_INVENTORY_STATUS ? null : next })}
          ariaLabel="Filter by stock status"
        />

        {/* Figma: 137×50, padding 16, gap 8, radius 100, gradient,
            আইকন 20×20 stroke 1.5, লেখা Sora 600 16px সাদা। */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`flex h-[50px] shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[16px] font-semibold leading-none text-white transition-opacity hover:opacity-90 ${FILTER_FOCUS_RING}`}
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          Add Ingredient
        </button>
      </div>

      <IngredientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        suppliers={suppliers}
      />
    </div>
  );
}
