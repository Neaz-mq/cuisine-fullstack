"use client";

import { useEffect, useState } from "react";
// ⚠️ `Clock` নয়, `AlarmClock` — প্রজেক্টে `Clock` কোথাও ব্যবহার হয়নি,
// তাই এই lucide সংস্করণে আছে কি না যাচাই করা নেই। `AlarmClock`,
// `MapPin`, `ChefHat` — তিনটেই আগে থেকে ব্যবহৃত, তাই প্রমাণিত।
import { AlarmClock, MapPin, ChefHat } from "lucide-react";
import { RESTAURANT_ADDRESS } from "@/lib/landing-content";

const DEFAULT_TIMEZONE = "Asia/Dhaka";
const DEFAULT_OPEN_HOUR = 10;
const DEFAULT_CLOSE_HOUR = 22;

/** 24-ঘণ্টার সংখ্যাকে "9:00 AM" ছাঁদে। */
function formatHour(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

/**
 * src/components/SiteTopBar.tsx
 *
 * Figma Frame 2147235996 — কালো সরু পটি: খোলার সময় · ঠিকানা ·
 * রান্নাঘরের অবস্থা। row, padding 10px 0, gap 46, BG #000000,
 * লেখা 14px।
 *
 * ── পুরনো TopBar থেকে কী রাখা হলো, কী বাদ ──────────────────────────
 *
 * ⚠️ পুরনো `TopBar.tsx` (৩৩৭ লাইন) **মুছিনি** — ওটা এখনো আছে, শুধু
 * `(main)/layout.tsx` আর ওটা ব্যবহার করে না। ভেতরে একটা হাতে-আঁকা
 * SVG অ্যানালগ ঘড়ি, একটা বড় সাজসজ্জার ছবি, আর "Online place order"
 * অংশ ছিল — Figma-র কালো পটিতে ওগুলোর কিছুই নেই, তাই আনা হয়নি।
 *
 * কিন্তু **যে logic-টা আসল, সেটা হুবহু এসেছে**:
 *   • `/api/settings` থেকে timezone আর খোলা/বন্ধের ঘণ্টা
 *   • রেস্তোরাঁর **নিজের** timezone-এ ঘণ্টা মেপে খোলা কি না ঠিক করা
 *     (দর্শকের নিজের ঘড়ি নয় — প্যারিসের দোকান ঢাকার দর্শককে
 *     "বন্ধ" দেখাবে না)
 *   • fetch ব্যর্থ হলে চুপচাপ ডিফল্ট, কোনো crash নয়
 *
 * ⚠️ প্রতি সেকেন্ডে নয়, প্রতি মিনিটে যাচাই — পুরনোটায় `setInterval`
 * ছিল ১০০০ms, কারণ ওখানে চলন্ত সেকেন্ডের কাঁটা দেখাতে হতো। এখানে
 * শুধু "খোলা না বন্ধ" দেখানো হয়, আর সেটা ঘণ্টায় একবার বদলায় —
 * সেকেন্ডে একবার state বদলানো মানে অকারণে মিনিটে ৬০টা render।
 */
export default function SiteTopBar({
  address = RESTAURANT_ADDRESS,
}: {
  address?: string;
}) {
  const [openHour, setOpenHour] = useState(DEFAULT_OPEN_HOUR);
  const [closeHour, setCloseHour] = useState(DEFAULT_CLOSE_HOUR);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  /**
   * ⚠️ শুরুতে `null`, `true` নয় — server আর client-এর প্রথম render
   * এক রাখতে। `new Date()` দিয়ে শুরু করলে server "খোলা" আর client
   * "বন্ধ" আঁকতে পারত, আর React hydration mismatch-এর নালিশ করত।
   * পুরনো TopBar-এও ঠিক এই কৌশলটাই ছিল।
   */
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.timezone) setTimezone(data.timezone);
        if (typeof data.kitchenOpenHour === "number") setOpenHour(data.kitchenOpenHour);
        if (typeof data.kitchenCloseHour === "number") setCloseHour(data.kitchenCloseHour);
      })
      .catch(() => {
        // settings না পেলে ডিফল্ট নিয়েই চলবে
      });
  }, []);

  useEffect(() => {
    const check = () => {
      const hourThere = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date()),
        10
      );
      setIsOpen(hourThere >= openHour && hourThere < closeHour);
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [timezone, openHour, closeHour]);

  return (
    <div className="w-full bg-black">
      {/**
       * ⚠️ ছোট পর্দায় `justify-start` + আড়াআড়ি scroll, ভাঁজ নয়।
       * তিনটে তথ্য ভাঁজ হয়ে তিন সারিতে নামলে কালো পটিটা প্রায় ১০০px
       * উঁচু হয়ে যেত আর পাতার মাথাটাই ঢেকে দিত। একটাই সারিতে রেখে
       * প্রয়োজনে সরানো যায়।
       *
       * ⚠️ `overflow-x-auto`-র সাথে `overflow-y-hidden` — নাহলে
       * ব্রাউজার y-অক্ষে `auto` ধরে নিয়ে একটা বাড়তি উল্লম্ব
       * scrollbar এনে ফেলে।
       */}
      <div className="mx-auto flex max-w-[1280px] items-center gap-6 overflow-x-auto overflow-y-hidden px-4 py-2.5 md:justify-center md:gap-[46px] md:px-10 xl:px-0">
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-sora text-[12px] font-medium leading-[1.7] text-white md:text-[14px]">
          <AlarmClock className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Open from {formatHour(openHour)} - {formatHour(closeHour)}
        </span>

        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-sora text-[12px] font-medium leading-[1.7] text-white md:text-[14px]">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {address}
        </span>

        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-sora text-[12px] font-medium leading-[1.7] text-white md:text-[14px]">
          <ChefHat className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {/**
           * ⚠️ `isOpen === null` মানে এখনো মাপা হয়নি (প্রথম render)।
           * তখন "Kitchen Available" লিখলে সেটা একটা আন্দাজ, আর
           * বন্ধ থাকলে এক পলকের জন্য ভুল তথ্য দেখাত। তাই নিরপেক্ষ লেখা।
           */}
          {isOpen === null
            ? "Kitchen Hours"
            : isOpen
              ? "Kitchen Available"
              : "Kitchen Closed"}
        </span>
      </div>
    </div>
  );
}
