"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  DEFAULT_SUPPLIER_STATUS,
  SUPPLIER_STATUS_OPTIONS,
  type SupplierStatusFilter,
} from "@/lib/supplier-status";
import {
  ALL_ROLES,
  KITCHEN_ROLE_FILTER_OPTIONS,
  type RoleFilterValue,
} from "@/lib/staff-roles";

/**
 * src/app/admin/kitchen/staff/KitchenStaffFilters.tsx
 *
 * The two client controls of the kitchen Staff page:
 *
 *  • KitchenStaffToolbar — Figma "Frame 2147236264": search (flex-grow) +
 *    "All Statuses ⌄" pill, both 50px high. No "Add New": a cook cannot
 *    create staff.
 *  • KitchenRoleFilter — the "All ⌄" pill on the Staff Information card
 *    header; only Chef / Cleaner, the two roles this page may show.
 *
 * URL params: q · status · role · period (the Overview card's filter). Each
 * control keeps the others' params and drops `page`, because a narrower
 * result could leave you on an empty page 5.
 */

const KEEP = ["q", "status", "role", "period"] as const;

function useUrlPush() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (changes: Record<string, string | null>) => {
    const params = new URLSearchParams();
    KEEP.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };
}

export function KitchenStaffToolbar({ status }: { status: SupplierStatusFilter }) {
  const searchParams = useSearchParams();
  const push = useUrlPush();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);

  // Keep the box in step when the URL changes from outside (back/forward) —
  // the "adjust state while rendering" pattern, not an effect.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  // Search 300ms after typing stops, not on every keystroke.
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => push({ q: query || null }), 300);
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
        {/* Input 16px (iOS Safari zooms the page on anything smaller). */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search staff by name or email"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora min-[480px]:pl-11 text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      <div className="flex shrink-0 items-center">
        {/* surface="white": the pill sits on the cream page, next to the
            white search box. */}
        <FilterMenu
          surface="white"
          value={status}
          options={SUPPLIER_STATUS_OPTIONS}
          onSelect={(next) => push({ status: next === DEFAULT_SUPPLIER_STATUS ? null : next })}
          ariaLabel="Filter by status"
        />
      </div>
    </div>
  );
}

export function KitchenRoleFilter({ value }: { value: RoleFilterValue }) {
  const push = useUrlPush();

  return (
    <FilterMenu
      value={value}
      options={KITCHEN_ROLE_FILTER_OPTIONS}
      onSelect={(next) => push({ role: next === ALL_ROLES ? null : next })}
      ariaLabel="Filter by role"
    />
  );
}
