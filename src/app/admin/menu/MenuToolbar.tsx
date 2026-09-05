"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_MENU_STATUS,
  MENU_STATUS_OPTIONS,
  type MenuStatusFilter,
} from "@/lib/menu-status-filter";
import MenuItemFormModal from "./MenuItemFormModal";

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * src/app/admin/menu/MenuToolbar.tsx
 *
 * Figma Frame 2147236264 — search ঘর (733×50) + Frame 2147236296
 * (gap 10): "All Statuses ⌄" pill (156×50) + "+ Add Item" gradient
 * বোতাম (136×50)। বাইরের gap 24।
 *
 * search ঘরটার গড়ন Staff/Suppliers/Inventory/Kitchen/Categories-এর
 * হুবহু নকল: `relative` মোড়ক + absolute আইকন + ইনপুটে `pl-10`।
 * ছয়টা পাতায় একই ঘর, তাই এক অক্ষরও আলাদা নয়।
 */
export default function MenuToolbar({
  status,
  categories,
  currency,
}: {
  status: MenuStatusFilter;
  /** নতুন পদের modal-এর Category dropdown-এর জন্য। */
  categories: readonly { value: string; label: string }[];
  currency?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [adding, setAdding] = useState(false);

  /**
   * URL বদলালে (back বোতাম, বা ছাঁকনি মোছা) ঘরের লেখাও মিলিয়ে নেওয়া।
   * render চলাকালীন তুলনা করে setState — useEffect-এর ভেতরে নয়, কারণ
   * সেটা react-hooks/set-state-in-effect ভাঙে।
   */
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  // টাইপ করার সময় প্রতিটা অক্ষরে নয়, থামার ৩০০ms পরে।
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const handleStatus = (next: MenuStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?status=all` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ হয়নি।
    if (next === DEFAULT_MENU_STATUS) params.delete("status");
    else params.set("status", next);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      <div className="relative h-[50px] min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by Item name"
          aria-label="Search menu items by name"
          /* ইনপুট ১৬px, placeholder ১২ — iOS Safari ১৬px-এর কম
             font-size-এর ইনপুটে ট্যাপ করলে পুরো পাতা zoom করে দেয়। */
          className={`h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]`}
        />
      </div>

      {/* Frame 2147236296: row, gap 10।
          ৩২০px-এ pill বাঁ কিনারায়, বোতাম ডানে — SuppliersToolbar-এর
          হুবহু একই ব্যবস্থা, আর একই কারণে: দুটোকেই ৫০px/১৬px করলে
          যোগফল ২৮৮px-এর জায়গায় আঁটে না। */}
      <div className="flex shrink-0 items-center justify-between gap-2 min-[480px]:justify-start min-[480px]:gap-2.5">
        {/**
         * ⚠️ pill-টা `surface="white"` — cream পাতার উপরে বসছে বলে।
         * উল্টোটা করলে (cream pill, cream পটভূমি) ওটা কার্যত অদৃশ্য
         * হয়ে যেত; FilterMenu.tsx-এর `surface` prop-এ পুরো ব্যাখ্যা।
         */}
        <FilterMenu
          surface="white"
          value={status}
          options={MENU_STATUS_OPTIONS}
          onSelect={handleStatus}
          ariaLabel="Filter items by availability"
        />

        {/**
         * Figma: 136×50, padding 16, gap 8, radius 100, gradient,
         * আইকন 20×20 stroke 1.5, লেখা Sora 600 16px সাদা।
         *
         * ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে
         * ঠিক 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
         * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**।
         *
         * ⚠️ `<Link href="/admin/menu/new">` নয়, modal — Categories
         * পাতায় "Add Categories"-এর সাথে একই আচরণ। তালিকা ছেড়ে যেতে
         * হয় না, আর ভুল করে খুললে Escape/Cancel-এ কিছুই হারায় না।
         */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={categories.length === 0}
          title={
            categories.length === 0
              ? "Add a category first — every item needs one."
              : undefined
          }
          className={`flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-[480px]:h-[50px] min-[480px]:px-4 min-[480px]:text-[16px] ${FOCUS_RING}`}
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Add Item
        </button>
      </div>

      <MenuItemFormModal
        open={adding}
        onClose={() => setAdding(false)}
        categories={categories}
        currency={currency}
      />
    </div>
  );
}
