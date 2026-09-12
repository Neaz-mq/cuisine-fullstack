"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_PAYMENT_STATUS,
  PAYMENT_STATUS_OPTIONS,
  type PaymentStatusFilter,
} from "@/lib/payment-filters";

/**
 * Figma-র খোঁজার ঘর + "All Statuses" pill।
 *
 * ⚠️ গড়নটা OrdersToolbar-এর হুবহু — একই debounce, একই "ডিফল্ট মান
 * URL-এ লেখা হয় না" নিয়ম, একই `page` মুছে ফেলা। দুটো পাতার toolbar
 * আলাদা আচরণ করলে staff-কে দুটো আলাদা অভ্যাস শিখতে হতো।
 */
export default function PaymentsToolbar({ status }: { status: PaymentStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  // পেছনে/সামনে গেলে URL-ই সত্য — ঘরটা তার সাথে মিলিয়ে নেওয়া হয়।
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
      params.delete("page");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const handleStatus = (next: PaymentStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_PAYMENT_STATUS) params.delete("status");
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
          placeholder="Search by customer name, order ID..."
          aria-label="Search transactions by customer name, email or order ID"
          /* ইনপুট ১৬px — iOS Safari তার কম font-size-এর ঘরে ট্যাপ করলে
             পুরো পাতা zoom করে দেয়। */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:pl-11 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px]"
        />
      </div>

      <FilterMenu
        surface="white"
        value={status}
        options={PAYMENT_STATUS_OPTIONS}
        onSelect={handleStatus}
        ariaLabel="Filter transactions by payment status"
      />
    </div>
  );
}
