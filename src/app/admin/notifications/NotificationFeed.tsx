"use client";

import { useState, useSyncExternalStore, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CircleX,
  FileCheck,
  HandCoins,
  MessageCircle,
  PackageMinus,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import type { AdminNotification } from "@/lib/notification-filters";

const ICONS = {
  ORDER: ShoppingBag,
  DELIVERY: Truck,
  RESERVATION: CalendarCheck,
  REVIEW: Star,
  STOCK: PackageMinus,
  CHAT: MessageCircle,
  CANCELLED: CircleX,
  PAYOUT: HandCoins,
  DOCUMENT: FileCheck,
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

/**
 * ⚠️ "Mark All as Read" বোতামটা এখানে নেই — সেটা toolbar-এ, খোঁজার ঘর
 * আর status ছাঁকনির পাশে (Figma যেমন দেখায়)। তিনটেই পুরো তালিকার উপর
 * কাজ করে, তাই একসাথে থাকাই যুক্তিসঙ্গত।
 */
export default function NotificationFeed({
  notifications,
  markReadUrl,
  showReadDot = false,
}: {
  notifications: AdminNotification[];
  /**
   * When set, opening an unread notification POSTs `{ id }` here first, so
   * just that one becomes read (rider panel). Left out = plain links, as
   * before (admin panel).
   */
  markReadUrl?: string;
  /** Read items get a green dot instead of no dot (unread stays orange). */
  showReadDot?: boolean;
}) {
  const isClient = useIsClient();
  const router = useRouter();
  // Ids opened in this tab — flips the dot at once, before the server
  // re-render brings the real `read` flag back.
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(new Set());

  async function handleOpen(event: MouseEvent<HTMLAnchorElement>, item: AdminNotification) {
    if (!markReadUrl || item.read || openedIds.has(item.id)) return;

    setOpenedIds((prev) => new Set(prev).add(item.id));
    const request = fetch(markReadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
      keepalive: true,
    });

    // New tab / window: let the browser do its thing, the request still goes.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      void request.catch(() => {});
      return;
    }

    // Same tab: wait for the write BEFORE navigating, otherwise the sidebar
    // badge (rendered by the layout) can be counted before the row exists.
    event.preventDefault();
    try {
      await request;
    } catch {
      // Offline etc. — still open the page; it just stays unread.
    }
    router.push(item.href);
    router.refresh();
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
                  const isRead = item.read || openedIds.has(item.id);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={(event) => void handleOpen(event, item)}
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
                        {/* Figma-র ছোট কমলা বিন্দু — অপঠিতগুলোয়। showReadDot
                            থাকলে পঠিতগুলোয় সবুজ (rider panel)। */}
                        {!isRead && (
                          <span
                            className="h-2 w-2 rounded-full bg-[#FF9540]"
                            aria-label="Unread"
                            role="img"
                          />
                        )}
                        {isRead && showReadDot && (
                          <span
                            className="h-2 w-2 rounded-full bg-[#22C55E]"
                            aria-label="Read"
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
