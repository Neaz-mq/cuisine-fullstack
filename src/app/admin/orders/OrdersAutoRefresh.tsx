"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * src/app/admin/orders/OrdersAutoRefresh.tsx
 *
 * Orders list নিজে থেকে হালনাগাদ রাখে — admin-কে refresh দিতে হয় না।
 *
 * ⚠️ কেন লাগে: তালিকাটা server component, তাই status বদলায় শুধু পাতা নতুন
 * করে আনলে। rider "Mark Delivered" চাপলে বা রান্নাঘর "Ready" চাপলে আরেকজনের
 * browser-এ এই পাতা পুরনো "On the Way" দেখিয়েই বসে থাকত।
 *
 * `router.refresh()` শুধু server-এর অংশ নতুন করে আনে — client state (খোলা
 * modal, বাছা rider, search ঘরের লেখা) হারায় না। তাই বসানো নিরাপদ।
 *
 * ⚠️ ট্যাব লুকানো থাকলে refresh হয় না (অকারণ query নয়), আর ট্যাবে ফিরলে
 * সাথে সাথে একবার হয় — অপেক্ষা না করেই টাটকা তালিকা।
 */
const REFRESH_INTERVAL_MS = 10_000; // Kitchen board-এর (১৫s) চেয়ে একটু দ্রুত

export default function OrdersAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const interval = setInterval(refreshIfVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router]);

  return null;
}
