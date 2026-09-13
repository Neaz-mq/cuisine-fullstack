"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Bell,
  CalendarCheck,
  PackageMinus,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import type { AdminNotification } from "@/lib/admin-notifications";

const ICONS = {
  ORDER: ShoppingBag,
  DELIVERY: Truck,
  RESERVATION: CalendarCheck,
  REVIEW: Star,
  STOCK: PackageMinus,
} as const;

/**
 * ⚠️ তারিখের ভাগ আর "2 min ago" — দুটোই কেবল browser-এ হিসাব হয়।
 *
 * "আজ" মানে দর্শকের ঘড়ির আজ, কিন্তু server Vercel-এ UTC-তে চলে। server
 * থেকে লিখলে বাংলাদেশে সন্ধ্যার পরের সব কিছু "Yesterday"-তে পড়ত, আর
 * React hydration mismatch-ও দিত। প্রথম render-এ তাই কিছুই দেখানো হয় না,
 * mount-এর পরে আসল লেখা বসে।
 */
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function relativeTime(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hr" : "hrs"} ago`;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Today" / "Yesterday" / "Jul 12" — দর্শকের ঘড়ি অনুযায়ী। */
function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationFeed({
  notifications,
  hasUnread,
}: {
  notifications: AdminNotification[];
  hasUnread: boolean;
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const [marking, setMarking] = useState(false);

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

  /**
   * দিন ধরে ভাগ — Figma-র "Today" / "Yesterday" শিরোনাম।
   *
   * ⚠️ ক্রম ধরে রাখা হয় (Map ব্যবহার করে), কারণ তালিকাটা আগে থেকেই
   * নতুন-থেকে-পুরনো সাজানো। নতুন করে sort করলে server-এর সাজানো ক্রমটাই
   * নষ্ট হতো।
   */
  const groups = new Map<string, AdminNotification[]>();
  if (isClient) {
    for (const item of notifications) {
      const key = dayLabel(item.createdAt);
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 font-frank-ruhl text-[24px] font-semibold leading-none text-black xl:text-[30px]">
          Notification
        </h2>

        {/* ⚠️ সব পড়া হয়ে গেলে বোতামটা নিষ্ক্রিয়, লুকানো নয় — হঠাৎ উধাও
            হয়ে যাওয়া বোতাম খুঁজতে গিয়ে staff ভাবতেন কিছু ভেঙেছে। */}
        <button
          type="button"
          onClick={markAllRead}
          disabled={marking || !hasUnread}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#F9F6F3] px-4 font-sora text-[13px] leading-none text-black transition-colors hover:bg-black/[0.06] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:h-11 min-[480px]:text-[14px]"
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {marking ? "Marking…" : "Mark all as Read"}
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-[16px] bg-[#F9F6F3] p-4 font-sora text-[14px] leading-[1.7] text-black/70">
          Nothing to catch up on right now.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([label, items]) => (
            <div key={label} className="flex flex-col gap-3">
              <span className="font-frank-ruhl text-[16px] font-semibold leading-none text-black">
                {label}
              </span>

              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const Icon = ICONS[item.kind];
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-4 rounded-[16px] bg-[#F9F6F3] p-4 transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="truncate font-frank-ruhl text-[15px] font-medium leading-none text-black md:text-[16px]">
                          {item.title}
                        </span>
                        <span className="truncate font-sora text-[12px] leading-none text-black/70">
                          {item.description}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-3">
                        <span className="whitespace-nowrap font-sora text-[12px] leading-none text-black/70">
                          {relativeTime(item.createdAt)}
                        </span>
                        {/* Figma-র ছোট কমলা বিন্দু — কেবল অপঠিতগুলোয়। */}
                        {!item.read && (
                          <span
                            className="h-2 w-2 rounded-full bg-[#FF9540]"
                            aria-label="Unread"
                            role="img"
                          />
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
