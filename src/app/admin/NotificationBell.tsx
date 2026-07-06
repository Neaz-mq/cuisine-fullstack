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

export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    // প্রথমবার শুধু বর্তমান latest order timestamp রেকর্ড করে রাখে,
    // পুরনো সব order-এর জন্য notification দেখায় না — শুধু এরপর থেকে যা নতুন আসবে
    fetch("/api/admin/notifications")
      .then((res) => res.json())
      .then((data) => {
        lastSeenRef.current = data.latestOrderAt;
      })
      .catch(() => {});

    const interval = setInterval(async () => {
      try {
        const url = lastSeenRef.current
          ? `/api/admin/notifications?since=${encodeURIComponent(lastSeenRef.current)}`
          : "/api/admin/notifications";
        const res = await fetch(url);
        const data = await res.json();

        if (data.newOrdersCount > 0) {
          setCount((prev) => prev + data.newOrdersCount);
          playBeep();
        }
        if (data.latestOrderAt) {
          lastSeenRef.current = data.latestOrderAt;
        }
      } catch {
        // network error হলে চুপচাপ পরের poll-এ আবার চেষ্টা করবে
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  function handleClick() {
    setCount(0);
    router.push("/admin/orders?status=PLACED");
  }

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
      aria-label="New order notifications"
    >
      <Bell className="w-5 h-5 text-gray-600" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-[#FF4C15] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}