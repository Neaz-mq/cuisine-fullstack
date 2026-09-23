"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_OFFER_STATUS,
  OFFER_STATUS_OPTIONS,
  type OfferStatusFilter,
} from "@/lib/offer-filters";
import OfferModal from "./OfferModal";
import type { MoneyFormat, OfferProduct } from "./types";

/**
 * Figma Frame 2147236298: "Search by Item name" (white, 50px, grows) +
 * "All Statuses ⌄" (white pill) + "Create Offer" (gradient, 50px), gap 24.
 * Same build as the Reviews and Menu toolbars.
 *
 * Search filters both cards (the offers and the "Add an Offer" list).
 * Changing search or status drops both page numbers.
 */
const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

export default function OffersToolbar({
  status,
  products,
  money,
}: {
  status: OfferStatusFilter;
  /** Products with no current offer — the list in "Create Offer". */
  products: OfferProduct[];
  money: MoneyFormat;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (params: URLSearchParams) => {
    params.delete("page");
    params.delete("addPage");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  // 300ms debounce, so the page isn't re-rendered on every key press.
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

  const handleStatus = (next: OfferStatusFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_OFFER_STATUS) params.delete("status");
    else params.set("status", next);
    push(params);
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      <div className="relative h-[50px] min-w-0 md:flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        {/* 16px text — iOS Safari zooms the page on smaller inputs. */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by Item name"
          aria-label="Search offers by item name"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[14px] placeholder:text-black/70 min-[480px]:pl-11 md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      <div className="flex items-center justify-between gap-2.5 md:justify-start">
        <FilterMenu
          className="shrink-0"
          surface="white"
          value={status}
          options={OFFER_STATUS_OPTIONS}
          onSelect={handleStatus}
          ariaLabel="Filter offers by status"
        />

        {/* Figma: gradient pill, 50px, padding 16, "+ Create Offer" Sora
            600 16px. Same class as the Menu page's "Add Item". */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 min-[480px]:h-[50px] min-[480px]:text-[16px] ${FOCUS_RING}`}
        >
          <Plus className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Create Offer
        </button>
      </div>

      <OfferModal
        open={creating}
        onClose={() => setCreating(false)}
        mode={{ kind: "create", products }}
        money={money}
      />
    </div>
  );
}
