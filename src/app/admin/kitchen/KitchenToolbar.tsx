"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_KITCHEN_STATUS,
  KITCHEN_STATUS_OPTIONS,
  type KitchenStatusFilter,
} from "@/lib/kitchen-status";

/**
 * src/app/admin/kitchen/KitchenToolbar.tsx
 *
 * Figma Frame 2147236264 — search ঘর (879×50) + "All Statuses" pill
 * (156×50), মাঝে gap 24।
 *
 * গড়নটা SuppliersToolbar/StaffToolbar-এর হুবহু নকল: `relative` মোড়ক +
 * absolute আইকন + ইনপুটে `pl-10`। তিনটে পাতায় একই ঘর, তাই এক অক্ষরও
 * আলাদা নয়।
 *
 * ⚠️ status-এর তালিকা আর যাচাই-function এখানে **নেই**, `lib/kitchen-status.ts`-এ।
 * এই ফাইলটা `"use client"`, আর ওখান থেকে component ছাড়া কিছু
 * server-এ ডাকা যায় না — page.tsx ঠিক ওই ভুলেই একবার ভেঙেছিল।
 */

export default function KitchenToolbar({ status }: { status: KitchenStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  /**
   * URL বদলালে (back বোতাম, বা ছাঁকনি মোছা) ঘরের লেখাও মিলিয়ে নেওয়া।
   * render চলাকালীন তুলনা করে setState — useEffect-এর ভেতরে নয়, কারণ
   * সেটা react-hooks/set-state-in-effect ভাঙে। বিস্তারিত ব্যাখ্যা
   * SuppliersToolbar-এ।
   */
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // ⚠️ `type` আর `sort` অন্য দুটো pill-এর, এই toolbar-এর নয় — কিন্তু তালিকায়
    // না রাখলে search বা status বদলালেই সেটা নীরবে "All Orders"-এ
    // ফিরে যেত। SuppliersToolbar-এ `period` নিয়ে একই কথা লেখা আছে।
    ["q", "status", "type", "sort"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  // টাইপ করার সময় প্রতিটা অক্ষরে নয়, থামার ৩০০ms পরে।
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => push({ q: query || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  return (
    <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-start min-[560px]:gap-6">
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
          placeholder="Search by Order ID"
          aria-label="Search kitchen orders by order ID"
          /* ইনপুট ১৬px, placeholder ১২ — iOS Safari ১৬px-এর কম
             font-size-এর ইনপুটে ট্যাপ করলে পুরো পাতা zoom করে দেয়। */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      {/* ⚠️ `surface="white"` — pill-টা cream পাতার উপরে বসে; ডিফল্ট
          cream রঙে ওটা পটভূমির সাথে মিশে যেত। */}
      <div className="shrink-0">
        <FilterMenu
          surface="white"
          value={status}
          options={KITCHEN_STATUS_OPTIONS}
          onSelect={(next) => push({ status: next === DEFAULT_KITCHEN_STATUS ? null : next })}
          ariaLabel="Filter kitchen orders by status"
        />
      </div>
    </div>
  );
}
