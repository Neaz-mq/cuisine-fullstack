"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  COUPON_STATUS_OPTIONS,
  DEFAULT_COUPON_STATUS,
  type CouponStatusFilter,
} from "@/lib/coupon-filters";
import CouponModal, { EMPTY_COUPON } from "./CouponModal";
import type { CategoryOption } from "./types";

/**
 * Figma: "Search by Item name" (white, 50px) + "All Statuses ⌄" + gradient
 * "+ Create Coupon", gap 24 — same build as the Offers and Reviews toolbars.
 * Search matches the code, headline and label. Changing search or status
 * drops ?page=.
 *
 * ?create=1 opens the modal straight away (the old /admin/coupons/new
 * address redirects here with it).
 */
const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function CouponsToolbar({
  status,
  categories,
  currency,
}: {
  status: CouponStatusFilter;
  categories: CategoryOption[];
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(() => searchParams.get("create") === "1");

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (params: URLSearchParams) => {
    params.delete("page");
    params.delete("create");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      push(params);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/searchParams change every render; we only react to the typed text
  }, [query, urlQuery]);

  const handleStatus = (next: CouponStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_COUPON_STATUS) params.delete("status");
    else params.set("status", next);
    push(params);
  };

  const closeModal = () => {
    setCreating(false);
    if (searchParams.get("create")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("create");
      router.replace(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      <div className="relative h-[50px] min-w-0 md:flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by code or name"
          aria-label="Search coupons by code, headline or label"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[14px] placeholder:text-black/70 min-[480px]:pl-11 md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      {/* ⚠️ 320px-এ দুটো shrink-0 পাশাপাশি জায়গা পেত না, বোতামটা কেটে
          যেত। এখন বোতামটা বাকি জায়গা নেয় (flex-1 min-w-0), আর খুব সরু
          পর্দায় লেখা/padding একটু ছোট হয়। md থেকে আগের মতো নিজের মাপে। */}
      <div className="flex min-w-0 items-center gap-2.5 md:justify-start">
        <FilterMenu
          className="shrink-0"
          surface="white"
          value={status}
          options={COUPON_STATUS_OPTIONS}
          onSelect={handleStatus}
          ariaLabel="Filter coupons by status"
        />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[13px] font-semibold leading-none text-white transition-opacity hover:opacity-90 min-[380px]:gap-2 min-[380px]:px-4 min-[380px]:text-[14px] min-[480px]:h-[50px] min-[480px]:text-[16px] md:flex-none ${FOCUS_RING}`}
        >
          <Plus className="h-4 w-4 shrink-0 min-[380px]:h-5 min-[380px]:w-5" strokeWidth={1.5} aria-hidden="true" />
          Create Coupon
        </button>
      </div>

      <CouponModal
        open={creating}
        onClose={closeModal}
        initial={EMPTY_COUPON}
        categories={categories}
        currency={currency}
      />
    </div>
  );
}
