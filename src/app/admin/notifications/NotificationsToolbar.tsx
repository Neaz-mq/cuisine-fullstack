"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Search } from "lucide-react";
import { toast } from "react-toastify";
import FilterMenu from "@/components/admin/FilterMenu";
import {
  NOTIFICATION_FILTERS,
  type NotificationFilter,
} from "@/lib/notification-filters";

/**
 * Figma-র toolbar: খোঁজার ঘর · "Mark All as Read" · "All Statuses"।
 *
 * ⚠️ "Mark All as Read" বোতামটা তালিকার শিরোনাম থেকে এখানে সরানো
 * হয়েছে — Figma-তে তিনটেই একই সারিতে, আর যুক্তিও তাই: তিনটেই পুরো
 * তালিকার উপর কাজ করে, কোনো একটা সারির উপর নয়।
 */
export default function NotificationsToolbar({
  status,
  hasUnread,
}: {
  status: NotificationFilter;
  hasUnread: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [marking, setMarking] = useState(false);

  // পেছনে/সামনে গেলে URL-ই সত্য — ঘরটা তার সাথে মিলিয়ে নেওয়া হয়।
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) params.set("q", query);
      else params.delete("q");
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const handleStatus = (next: NotificationFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ALL") params.delete("status");
    else params.set("status", next);
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    try {
      const res = await fetch("/api/admin/notifications/read", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't mark these as read.");
      toast.success("All notifications marked as read.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't mark these as read.");
    } finally {
      setMarking(false);
    }
  }

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
          aria-label="Search notifications"
          /* ইনপুট ১৬px — iOS Safari তার কম font-size-এর ঘরে ট্যাপ করলে
             পুরো পাতা zoom করে দেয়। */
          className="h-[50px] w-full text-ellipsis rounded-full bg-white pl-10 pr-4 font-sora text-[16px] font-normal leading-none text-black/70 placeholder:text-[12px] placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] min-[480px]:pl-11 min-[480px]:placeholder:text-[14px] md:placeholder:text-[16px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* ⚠️ সব পড়া হয়ে গেলে নিষ্ক্রিয়, লুকানো নয় — হঠাৎ উধাও হয়ে
            যাওয়া বোতাম খুঁজতে গিয়ে staff ভাবতেন কিছু ভেঙেছে। */}
        <button
          type="button"
          onClick={markAllRead}
          disabled={marking || !hasUnread}
          className="flex h-[50px] shrink-0 items-center gap-2 rounded-full bg-white px-4 font-sora text-[14px] leading-none text-black transition-colors hover:bg-black/[0.03] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]"
        >
          <CheckCheck className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          {marking ? "Marking…" : "Mark All as Read"}
        </button>

        <FilterMenu
          surface="white"
          value={status}
          options={NOTIFICATION_FILTERS}
          onSelect={handleStatus}
          ariaLabel="Filter notifications by status"
        />
      </div>
    </div>
  );
}
