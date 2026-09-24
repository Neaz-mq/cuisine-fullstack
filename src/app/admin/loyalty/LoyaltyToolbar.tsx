"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * Figma: "Search by Customer Name, Email…" (white, 50px, grows) +
 * "All Statuses ⌄" (white pill), gap 24 — same build as the Users and
 * Coupons toolbars. The status menu filters members by ranking.
 * Changing either drops ?page=.
 */
export default function LoyaltyToolbar({
  tier,
  options,
}: {
  tier: string;
  /** "all" first, then every ranking. */
  options: FilterMenuOption<string>[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const push = (params: URLSearchParams) => {
    params.delete("page");
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

  const handleTier = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("tier");
    else params.set("tier", next);
    push(params);
  };

  return (
    <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:gap-6">
      <div className="relative h-[50px] min-w-0 min-[560px]:flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black min-[480px]:h-5 min-[480px]:w-5"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by Customer Name, Email…"
          aria-label="Search members by name, email or phone"
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[14px] placeholder:text-black/70 min-[480px]:pl-11 md:placeholder:text-[16px] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px]"
        />
      </div>

      <FilterMenu
        className="shrink-0 self-start min-[560px]:self-auto"
        surface="white"
        value={tier}
        options={options}
        onSelect={handleTier}
        ariaLabel="Filter members by ranking"
      />
    </div>
  );
}
