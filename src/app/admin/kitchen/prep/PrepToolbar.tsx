"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import FilterMenu, {
  FILTER_FOCUS_RING,
  type FilterMenuOption,
} from "@/components/admin/FilterMenu";
import { DEFAULT_PREP_STATUS, type PrepStatusFilter } from "@/lib/kitchen-dashboard";
import AddPrepTaskModal from "./AddPrepTaskModal";

const STATUS_OPTIONS: FilterMenuOption<PrepStatusFilter>[] = [
  { value: "all", label: "All", triggerLabel: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
];

/**
 * src/app/admin/kitchen/prep/PrepToolbar.tsx
 *
 * Figma Frame 2147236265: search (flex-grow) · "All Statuses ⌄" ·
 * gradient "+ Add Task", all 50px tall — the same shape as SuppliersToolbar
 * (debounced search into the URL, same focus ring), so it behaves the
 * same on every page.
 */
export default function PrepToolbar({ status }: { status: PrepStatusFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [modalOpen, setModalOpen] = useState(false);

  // Back/forward changes the URL from outside — pull the box along
  // (compare during render, the React-docs pattern, not an effect).
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    // `page` is left out on purpose: a narrower filter on page 4 would
    // otherwise land on an empty screen. `period` belongs to the Overview
    // card above, but must survive a search.
    ["q", "status", "period"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  // Search 300ms after typing stops, not one round-trip per keystroke.
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => push({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

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
          aria-label="Search prep tasks"
          // 16px input text: iOS Safari zooms the page on anything smaller.
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 min-[480px]:justify-start min-[480px]:gap-2.5">
        <FilterMenu
          surface="white"
          value={status}
          options={STATUS_OPTIONS}
          onSelect={(next) => push({ status: next === DEFAULT_PREP_STATUS ? null : next })}
          ariaLabel="Filter by status"
        />

        {/* Figma "+ Add Task": 50px, padding 16, gap 8, radius 100,
            linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%). */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[12px] font-semibold leading-none text-white transition-opacity hover:opacity-90 min-[480px]:h-[50px] min-[480px]:px-4 min-[480px]:text-[16px] ${FILTER_FOCUS_RING}`}
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          Add Task
        </button>
      </div>

      <AddPrepTaskModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
