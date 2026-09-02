"use client";

import { useEffect, useState } from "react";

/**
 * src/components/admin/useScreenTier.ts
 *
 * পর্দা এই মুহূর্তে কোন চওড়ার ধাপে আছে — "narrow" | "mid" | "wide"।
 *
 * ── কেন এটা দরকার ──────────────────────────────────────────────────────
 *
 * প্রায় সব responsive কাজ CSS-এই হয়, আর সেটাই ভালো। কিন্তু placeholder
 * একটা **attribute**, element-এর ভেতরের লেখা নয় — `::placeholder`-এ
 * font-size বা রঙ বদলানো গেলেও `content` কাজ করে না। তাই লেখাটাই
 * বদলাতে হলে JS-কে প্রস্থ জানতেই হয়।
 *
 * ⚠️ CSS দিয়ে হয় এমন কিছুর জন্য এটা ব্যবহার করবেন না। JS-এ মাপা মানে
 * server render আর ব্রাউজারের মধ্যে একটা ফাঁক তৈরি হওয়া (নিচে দেখুন);
 * `min-[480px]:` লিখলে সেই ফাঁকটাই থাকে না।
 *
 * ── সীমানা দুটো কেন এখানে ──────────────────────────────────────────────
 *
 *   narrow  < 480   ফোন
 *   mid     480–767 বড় ফোন / ছোট tablet
 *   wide    ≥ 768   tablet ও তার উপরে
 *
 * ৪৮০-টা UsersToolbar-এর wrapper-এর সাথে মেলানো: ঠিক ওখানেই search আর
 * "All Statuses" pill এক সারিতে আসে। দুটো আলাদা হলে একটা সরু ফাঁকে
 * layout এক রকম আর লেখা আরেক রকম ধরে নিত।
 *
 * ⚠️ উপরের সীমানাটা আগে ১০২৪ ছিল, আর সেটা ভুল জায়গায় ছিল। যুক্তি
 * ছিল "একটাই সীমানা মনে রাখা সহজ", কিন্তু ফলটা হলো ট্যাবলেটে
 * (৭৬৮px) ছাঁটা লেখা — অথচ সেখানে ইনপুটের ভেতরে ~৪৯৬px জায়গা,
 * আর পুরো লেখাটা লাগে ~২৫৭px। অর্থাৎ জায়গা থাকা সত্ত্বেও তথ্য
 * লুকানো হচ্ছিল।
 *
 *   ৪৮০ (pill সহ)  → 448 − 156 − 24 − 60 = 208px  ← এখানে সত্যিই টান
 *   ৭৬৮ (pill সহ)  → 736 − 156 − 24 − 60 = 496px  ← এখানে নয়
 *
 * তাই ৭৬৮ থেকেই "wide"। সরলতার চেয়ে সঠিক সীমানাটাই দামি।
 */
export type ScreenTier = "narrow" | "mid" | "wide";

export function useScreenTier(): ScreenTier {
  /**
   * ⚠️ ডিফল্ট "wide", আর সেটা ইচ্ছাকৃত। server render-এর সময় পর্দার
   * প্রস্থ জানার কোনো উপায় নেই — `window` তখন নেই — তাই একটা ধরে
   * নিতেই হয়, আর mount হলে ঠিক করে নিতে হয়।
   *
   * ফলে ৩২০px-এ এক ফ্রেমের জন্য বড় পর্দার লেখাটা দেখা যেতে পারে।
   * উল্টোটা — ডিফল্ট "narrow" — করলে desktop-এ প্রতিবার ছোট লেখাটা
   * ঝলকে উঠত, আর ব্যবহারকারী সেখানেই বেশি।
   */
  const [tier, setTier] = useState<ScreenTier>("wide");

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 479px)");
    const wide = window.matchMedia("(min-width: 768px)");

    const sync = () => setTier(narrow.matches ? "narrow" : wide.matches ? "wide" : "mid");
    sync();

    // উইন্ডো টানলে বা ফোন ঘোরালেও মিলিয়ে নেয়। একবার মেপে ছেড়ে দিলে
    // tablet ঘোরানোর পর লেখাটা ভুল ধাপে আটকে থাকত।
    narrow.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      narrow.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  return tier;
}