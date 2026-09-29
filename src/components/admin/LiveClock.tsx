"use client";

import { useSyncExternalStore } from "react";
import { Clock3 } from "lucide-react";

/**
 * Rider panel topbar (Figma): the current time — "8:45 PM" — in a cream
 * pill next to the bell, so a rider on the road sees the time at a glance.
 *
 * The time is read from the browser's clock. On the server (and in the
 * first paint) there is no "now" that would match the browser's, so the
 * pill renders empty until the page is running — otherwise React would
 * warn about the server and browser disagreeing.
 */

const TICK_MS = 15_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}

function currentTime() {
  // Rounded to the minute so the store only "changes" once a minute.
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function LiveClock({ className = "" }: { className?: string }) {
  const time = useSyncExternalStore(subscribe, currentTime, () => null);

  return (
    <span
      className={`h-[50px] shrink-0 items-center gap-2 rounded-full bg-[#F9F6F3] px-4 font-sora text-[16px] leading-none text-black ${className}`}
    >
      <Clock3 className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <time suppressHydrationWarning className="min-w-[62px] tabular-nums">
        {time ?? ""}
      </time>
    </span>
  );
}
