"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect } from "react";

const STATUSES = ["ALL", "PLACED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export default function OrdersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== "ALL") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.delete("page"); // any filter change resets pagination
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  // Debounce search input so we don't push a new URL on every keystroke
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query !== (searchParams.get("q") ?? "")) {
        updateParams({ q: query });
      }
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <input
        type="text"
        placeholder="Search by customer name or email..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#2C6252]"
      />
      <select
        defaultValue={searchParams.get("status") ?? "ALL"}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {isPending && <span className="text-xs text-gray-400 self-center">Updating…</span>}
    </div>
  );
}