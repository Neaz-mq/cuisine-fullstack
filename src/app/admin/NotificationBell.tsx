"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

const POLL_INTERVAL_MS = 15000; // প্রতি ১৫ সেকেন্ডে চেক করবে

// mp3 ফাইলের বদলে Web Audio API দিয়ে সরাসরি কোডেই একটা ছোট "ping" শব্দ
// generate করা হচ্ছে — কোনো external audio file হোস্ট করার দরকার নেই।
function playBeep() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 pitch
    oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1); // পরের সুর একটু উঁচুতে

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext ব্লক থাকলে (autoplay policy) চুপচাপ ignore করা হচ্ছে —
    // badge visual তো দেখাচ্ছেই
  }
}

/**
 * src/app/admin/NotificationBell.tsx
 *
 * Generic polling notification bell — NOT hardcoded to "new orders"
 * anymore. Originally it was, and it lived in the shared admin sidebar
 * layout, so it also rendered (and mis-navigated) for DELIVERY/KITCHEN
 * staff who don't have the "orders" scope /admin/orders needs. Rather
 * than duplicate this whole polling/beep/badge component for the rider's
 * "new delivery assigned to you" notification, it's parameterized here —
 * same pattern as ChatPanel.tsx being shared between the rider and
 * customer sides of chat instead of two near-identical components.
 *
 * Each specific bell is just a call site with different props:
 *   admin/layout.tsx (orders scope)   -> fetchUrl /api/admin/notifications
 *   admin/layout.tsx (DELIVERY role)  -> fetchUrl /api/rider/notifications
 *
 * The backing API response only needs the two field names below — no
 * other shape assumptions are made, so a third bell (e.g. a future
 * "reservation confirmed" notification) is just another call site with
 * its own fetchUrl/countKey/latestKey/navigateTo, not a new component.
 */
export default function NotificationBell({
  fetchUrl,
  countKey,
  latestKey,
  navigateTo,
  ariaLabel,
}: {
  /** Endpoint returning `{ [countKey]: number, [latestKey]: string | null }`. */
  fetchUrl: string;
  /** Field name in the response holding "how many new items since `since`". */
  countKey: string;
  /** Field name in the response holding the most recent item's timestamp —
   * fed back as `?since=` on the next poll. */
  latestKey: string;
  /** Where clicking the bell navigates. */
  navigateTo: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    // প্রথমবার fetch করার সময় বর্তমান latest timestamp রেকর্ড করে রাখে
    // (পরের poll-এর baseline হিসেবে), এবং সেই মুহূর্তে যতগুলো item এখনো
    // unaddressed অবস্থায় আছে (since ছাড়া কল করায় API সবগুলো গোনে) সেটাও
    // সাথে সাথে badge-এ দেখিয়ে দেয়। আগে এই initial count ফেলে দেওয়া হতো,
    // ফলে admin যদি panel বন্ধ রেখে/home page-এ থেকে কিছুক্ষণ পর dashboard-এ
    // ঢুকতেন, ততক্ষণে জমে থাকা order গুলো bell miss করে যেত — সেগুলো তো
    // "mount-এর পরে আসা" না, কিন্তু ঠিক ততটাই unaddressed। beep অবশ্য
    // বাজানো হয় না এই initial load-এ, শুধু পরের poll-এ সত্যিকারের নতুন
    // item এলে বাজবে — নাহলে প্রতিটা page refresh-এই শব্দ হতো।
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => {
        lastSeenRef.current = data[latestKey] ?? null;
        setCount(data[countKey] ?? 0);
      })
      .catch(() => {});

    const interval = setInterval(async () => {
      try {
        const url = lastSeenRef.current
          ? `${fetchUrl}?since=${encodeURIComponent(lastSeenRef.current)}`
          : fetchUrl;
        const res = await fetch(url);
        const data = await res.json();

        const newCount = data[countKey] ?? 0;
        if (newCount > 0) {
          setCount((prev) => prev + newCount);
          playBeep();
        }
        if (data[latestKey]) {
          lastSeenRef.current = data[latestKey];
        }
      } catch {
        // network error হলে চুপচাপ পরের poll-এ আবার চেষ্টা করবে
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchUrl/countKey/latestKey are stable per call site, not expected to change on re-render
  }, []);

  function handleClick() {
    setCount(0);
    router.push(navigateTo);
  }

  return (
    <button
      onClick={handleClick}
      /* Figma layout panel: Hug 50×50, radius 100px, padding 15px,
         BG #F9F6F3 — অর্থাৎ ডান পাশের user card-এর মতোই একটা বৃত্ত।
         আগে এটা ছিল rounded-md আর background-হীন, তাই পাশের গোল
         pill-টার সাথে বেমানান লাগত। padding 15px + icon 20px = 50। */
      /**
       * তিন ধাপ: ৩২ → ৪৪ → ৫০।
       *
       * ⚠️ মাঝের ধাপটা (৪৪) আগে ছিল না, আর সেটাই ভুল ছিল। ৩৯০px-এ
       * এটা সরাসরি ৫০ হয়ে যেত, অথচ তার পাশের hamburger আর search
       * বোতাম ৪৪ — ফলে একই সারিতে তিনটে গোল বোতামের একটা বাকি
       * দুটোর চেয়ে বড় দেখাত। Figma-তে ওরা সবসময় সমান (মোবাইলে
       * তিনটেই ৩২)।
       *
       * ৫০-এ ফেরা md থেকে, কারণ তখন search icon-বোতামটা আর থাকে না
       * (তার জায়গায় পুরো search ঘর) — অর্থাৎ তুলনা করার মতো পাশের
       * বোতামটাই নেই, আর ডেস্কটপে bell আর avatar দুটোই ৫০।
       */
      className="relative h-8 w-8 min-[390px]:h-11 min-[390px]:w-11 md:h-[50px] md:w-[50px] shrink-0 flex items-center justify-center rounded-full bg-[#F9F6F3] hover:bg-black/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C6252]/30"
      aria-label={ariaLabel}
    >
      <Bell className="h-4 w-4 min-[390px]:h-5 min-[390px]:w-5 text-black/70" strokeWidth={1.8} />
      {count > 0 && (
        /* Figma-তে badge-টা বৃত্তের *বাইরে* উঁকি দেয়, ভেতরে নয় — ডান
           প্রান্তে মিলিয়ে, উপরে সামান্য বেরিয়ে। ভেতরে বসালে ওটা
           ঘণ্টার গায়ে চেপে বসে আর দুটোই পড়তে অসুবিধা হয়।

           `min-w` + `px-1`, স্থির চওড়া নয়: গণনা দুই অঙ্কে গেলে (১২টা
           নতুন order) স্থির ২০px-এ সংখ্যাটা কেটে যেত। এক অঙ্কে এটা
           নিখুঁত বৃত্তই থাকে। */
        <span className="absolute -top-0.5 -right-0.5 min-[390px]:right-0 bg-red-600 text-white text-[10px] min-[390px]:text-[11px] font-bold leading-none rounded-full h-4 min-w-[16px] min-[390px]:h-5 min-[390px]:min-w-[20px] px-1 flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}