"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_ORDER_STATUS,
  ORDER_STATUS_OPTIONS,
  type OrderStatusFilter,
} from "@/lib/order-status-filter";

/**
 * src/app/admin/orders/OrdersToolbar.tsx
 *
 * Figma — search ঘর + "All Statuses ⌄" pill।
 *
 * ⚠️ পুরোটাই নতুন করে লেখা। আগের সংস্করণটা ছিল একটা ধূসর
 * `border-gray-300` ইনপুট আর একটা native `<select>` — অ্যাপের নকশা-
 * ব্যবস্থার সম্পূর্ণ বাইরে। search ঘরটার গড়ন এখন
 * Staff/Suppliers/Inventory/Kitchen/Categories/Menu-এর হুবহু নকল:
 * `relative` মোড়ক + absolute আইকন + ইনপুটে `pl-10`।
 *
 * ⚠️ `<select>`-এর বদলে `FilterMenu` — native dropdown-এর **খোলা
 * তালিকাটা** browser আঁকে, CSS পৌঁছয় না। বাকি সব ছাঁকনি এই
 * component দিয়েই চলে, তাই এটাও।
 */
export default function OrdersToolbar({ status }: { status: OrderStatusFilter }) {
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
      /**
       * ⚠️ খোঁজা শুরু করলে page ১-এ ফেরত — নাহলে কেউ ৩ নম্বর page-এ
       * থেকে খুঁজলে ফল দুটোই হতে পারত: খালি পাতা (নতুন ফলে ৩ নম্বর
       * page নেই), অথবা ফলের মাঝখান থেকে শুরু।
       */
      params.delete("page");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const handleStatus = (next: OrderStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?status=ALL` দেখতে এমন লাগে
    // যেন কিছু ছাঁকা হয়েছে, অথচ হয়নি।
    if (next === DEFAULT_ORDER_STATUS) params.delete("status");
    else params.set("status", next);
    params.delete("page");
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
          placeholder="Search by Customer Name or Email..."
          aria-label="Search orders by customer name, email or order ID"
          /* ইনপুট ১৬px, placeholder ১২ — iOS Safari ১৬px-এর কম
             font-size-এর ইনপুটে ট্যাপ করলে পুরো পাতা zoom করে দেয়। */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:pl-11 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px]"
        />
      </div>

      {/**
       * ⚠️ pill-টা `surface="white"` — cream পাতার উপরে বসছে বলে।
       * উল্টোটা করলে (cream pill, cream পটভূমি) ওটা কার্যত অদৃশ্য
       * হয়ে যেত; FilterMenu.tsx-এর `surface` prop-এ পুরো ব্যাখ্যা।
       */}
      <FilterMenu
        surface="white"
        value={status}
        options={ORDER_STATUS_OPTIONS}
        onSelect={handleStatus}
        ariaLabel="Filter orders by status"
      />
    </div>
  );
}
