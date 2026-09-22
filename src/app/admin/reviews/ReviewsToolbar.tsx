"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_REVIEW_STATUS,
  REVIEW_STATUS_OPTIONS,
  type ReviewStatusFilter,
} from "@/lib/review-filters";

/**
 * Figma: "Search by Customer Name, Email..." (white, 50px, full width) +
 * "All Statuses ⌄" (white pill). Same build as the Insights and Menu
 * toolbars. Search also matches the menu item's name.
 *
 * Changing either one also drops ?page=, so you never land on page 4 of a
 * list that now only has one page.
 */
export default function ReviewsToolbar({ status }: { status: ReviewStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Back/forward or a link changed ?q= — show that in the box too.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  // 300ms debounce, so the page isn't re-rendered on every key press.
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("page");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/searchParams change every render; we only react to the typed text
  }, [query, urlQuery]);

  const handleStatus = (next: ReviewStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (next === DEFAULT_REVIEW_STATUS) params.delete("status");
    else params.set("status", next);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4 md:gap-6">
      <div className="relative h-[50px] min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        {/* Input text is 16px on purpose — iOS Safari zooms the whole page
            when you tap an input smaller than 16px. */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by Customer Name, Email..."
          aria-label="Search reviews by customer name, email or menu item"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:pl-11 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      <FilterMenu
        className="shrink-0 self-start min-[480px]:self-auto"
        surface="white"
        value={status}
        options={REVIEW_STATUS_OPTIONS}
        onSelect={handleStatus}
        ariaLabel="Filter reviews by status"
      />
    </div>
  );
}
