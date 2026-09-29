"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu from "@/components/admin/FilterMenu";

/**
 * A pill dropdown that writes its choice to one URL parameter (`?type=`),
 * so the server filters and Export Report downloads the same rows. The
 * default choice stays out of the URL; changing it goes back to page 1.
 */
export default function UrlSelect<T extends string>({
  param,
  value,
  defaultValue,
  options,
  ariaLabel,
  surface = "cream",
}: {
  param: string;
  value: T;
  defaultValue: T;
  options: readonly { value: T; label: string }[];
  ariaLabel: string;
  surface?: "cream" | "white";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: T) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultValue) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu className="shrink-0" surface={surface} value={value} options={options} onSelect={select} ariaLabel={ariaLabel} />
  );
}
