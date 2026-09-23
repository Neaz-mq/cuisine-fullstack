"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * A FilterMenu pill that keeps its choice in the URL (?cat=, ?overview=…),
 * so the page stays a server component and a refresh or a shared link
 * shows the same view. The default choice is left out of the URL.
 *
 * `resetParams` — keys to drop on change, e.g. the card's own page
 * number: a new filter means a new list, and page 4 of the old one may
 * not exist any more.
 */
export default function UrlFilterMenu<T extends string>({
  param,
  value,
  defaultValue,
  options,
  ariaLabel,
  resetParams = [],
  surface = "cream",
  className = "shrink-0",
}: {
  param: string;
  value: T;
  defaultValue: T;
  options: readonly FilterMenuOption<T>[];
  ariaLabel: string;
  resetParams?: string[];
  surface?: "cream" | "white";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: T) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultValue) params.delete(param);
    else params.set(param, next);
    for (const key of resetParams) params.delete(key);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      className={className}
      surface={surface}
      value={value}
      options={options}
      onSelect={select}
      ariaLabel={ariaLabel}
    />
  );
}
