"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu, { FILTER_FOCUS_RING } from "@/components/admin/FilterMenu";
import {
  DEFAULT_SUPPLIER_STATUS,
  SUPPLIER_STATUS_OPTIONS,
  type SupplierStatusFilter,
} from "@/lib/supplier-status";
import SupplierFormModal from "./SupplierFormModal";

/**
 * src/app/admin/suppliers/SuppliersToolbar.tsx
 *
 * Figma Frame 2147236297: সার্চ ঘর (flex-grow) + "All Statuses ⌄" +
 * "+ Add New", gap 24 / 10, সবার উচ্চতা 50।
 *
 * StaffToolbar-এর হুবহু গড়ন — debounce, URL param, একই focus চিহ্ন।
 */
export default function SuppliersToolbar({ status }: { status: SupplierStatusFilter }) {
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
    //
    // ⚠️ `period` তালিকার ছাঁকনি নয় (ওটা উপরের Overview কার্ডের),
    // কিন্তু এখানে না রাখলে search বদলালেই সেটা নীরবে "All"-এ ফিরে যেত।
    ["q", "status", "period", "dperiod"].forEach((key) => {
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
      {/**
       * ⚠️ গড়নটা StaffToolbar-এর হুবহু নকল, ইচ্ছাকৃতভাবে — `<label>`-এর
       * ভেতরে flex নয়, বরং `relative` মোড়ক + absolute আইকন + ইনপুটে
       * `pl-10`। ক্লাসগুলোও এক অক্ষর ধরে এক।
       *
       * কেন এত আক্ষরিক: এটা তিনটে পাতায় একই জিনিস (Staff · Suppliers ·
       * Inventory), আর ব্যবহারকারী পাতা বদলালে ঘরটা যেন এক চুলও না
       * নড়ে। আগে এখানে উচ্চতা ৩৬ আর flex+gap ছিল — ভেতরের হিসাব
       * একই দাঁড়ালেও কাঠামো আলাদা, আর সেই আলাদা কাঠামোই পরের বার
       * আবার আলাদা করে বদলাতে হতো।
       *
       * ⚠️ Figma-র ৩২০px frame এই ঘরটাকে ৩৬px উঁচু আঁকে (288 × 36),
       * কিন্তু Staff-এর সাথে মিল রাখাই এখানে আগে — সিদ্ধান্তটা
       * স্পষ্টভাবে নেওয়া, তিনটে পাতাতেই সমানভাবে খাটে।
       *
       * ⚠️ নিচের দুটো pill কিন্তু ৩৬px আর padding ১২-তেই থাকল।
       * ওগুলোকেও ৫০/১৬px করলে দাঁড়াত 147.7 + 8 + 176.8 = 332.5,
       * অথচ জায়গা ২৮৮ — এক সারিতে কিছুতেই আঁটত না। search ঘরটা
       * নিজের সারিতে একা, তাই ওখানে জায়গা আছে; ওদের নেই।
       */}
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
          placeholder="Search by name, email or phone…"
          aria-label="Search suppliers"
          /**
           * ⚠️ ইনপুট ১৬px, placeholder ১২ — iOS Safari ১৬px-এর কম
           * font-size-এর ইনপুটে ট্যাপ করলে পুরো পাতা zoom করে দেয়,
           * আর ফেরানো যায় না। আগে এখানে ১৫px ছিল, অর্থাৎ iPhone-এ
           * প্রতিবার খোঁজা শুরু করলেই পাতা লাফ দিত।
           *
           * `text-ellipsis` — ফন্ট লোড হওয়ার আগে fallback দিয়ে আঁকা
           * হলে লেখাটা সামান্য চওড়া হয়; তখনও যেন অক্ষরের মাঝখানে
           * খাড়া না কেটে "…"-এ শেষ হয়।
           */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      {/* ৩২০px-এ pill বাঁ কিনারায়, বোতাম ডানে — দুটোর যোগফল ২৬৫,
          জায়গা ২৮৮। */}
      <div className="flex shrink-0 items-center justify-between gap-2 min-[480px]:justify-start min-[480px]:gap-2.5">
        {/* ⚠️ `surface="white"` — এই pill-টা cream পাতার উপরে বসে,
            search ঘর আর "Add New" বোতামের মাঝখানে। ডিফল্ট cream
            রঙে ওটা পটভূমির সাথে মিশে গিয়ে কার্যত অদৃশ্য ছিল।
            বিস্তারিত FilterMenu.tsx-এর `surface` prop-এ। */}
        <FilterMenu
          surface="white"
          value={status}
          options={SUPPLIER_STATUS_OPTIONS}
          onSelect={(next) =>
            push({ status: next === DEFAULT_SUPPLIER_STATUS ? null : next })
          }
          ariaLabel="Filter by status"
        />

        {/**
         * Figma-র "+ Add New": 137×50, padding 16, gap 8, radius 100,
         * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`,
         * আইকন 20×20 stroke 1.5, লেখা Sora 600 16px সাদা।
         *
         * gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে
         * ঠিক 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
         * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**।
         */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 min-[480px]:h-[50px] min-[480px]:px-4 min-[480px]:text-[16px] ${FILTER_FOCUS_RING}`}
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          Add New
        </button>
      </div>

      <SupplierFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
