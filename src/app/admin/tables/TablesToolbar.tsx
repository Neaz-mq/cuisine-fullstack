"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";

/**
 * src/app/admin/tables/TablesToolbar.tsx
 *
 * Figma Frame 2147236264 — search ঘর + gradient "Add Table" বোতাম,
 * Welcome header-এর ঠিক নিচে।
 *
 * ⚠️ CategoriesToolbar-এর হুবহু নকল, এক অক্ষরও আলাদা নয়। Staff,
 * Suppliers, Inventory, Kitchen আর Categories — পাঁচটা পাতায় একই ঘর,
 * তাই ষষ্ঠটাতে নতুন কিছু বানানোর কারণ নেই। কেবল placeholder, aria
 * লেখা আর বোতামের নামটা বদলেছে।
 */
export default function TablesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

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
          placeholder="Search by table number or name"
          aria-label="Search tables by number or name"
          /* ইনপুট ১৬px, placeholder ১২ — iOS Safari ১৬px-এর কম
             font-size-এর ইনপুটে ট্যাপ করলে পুরো পাতা zoom করে দেয়। */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:pl-11 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px]"
        />
      </div>

      {/**
        * Figma: 190×50, padding 16, gap 8, radius 100, gradient,
        * আইকন 20×20 stroke 1.5, লেখা Sora 600 16px সাদা।
        *
        * ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে
        * ঠিক 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
        * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**।
        *
        * ⚠️ modal-টা TablesBoard-এ, তাই ক্লিকটা সেখানকার একটা লুকানো
        * বোতামে পাঠানো হয়। বিকল্প ছিল modal-টা এখানেও বসানো — কিন্তু
        * তাতে TableFormModal-এর দুটো copy থাকত (একটা যোগ করার, একটা
        * সম্পাদনার), আর ভবিষ্যতে একটাতে বদল করে অন্যটায় ভুলে যাওয়াটা
        * সময়ের ব্যাপার মাত্র।
        *
        * ⚠️ লুকানো বোতামটা `sr-only`, `hidden` নয় — `display: none`
        * হলে `.click()` কাজ করত না।
        */}
      <button
        type="button"
        onClick={() => document.getElementById("admin-tables-add-trigger")?.click()}
        className="flex h-[50px] shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] min-[480px]:px-4 min-[560px]:w-auto md:text-[16px]"
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        Add Table
      </button>
    </div>
  );
}
