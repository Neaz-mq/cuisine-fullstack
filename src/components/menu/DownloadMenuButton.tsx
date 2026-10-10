"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

/**
 * src/components/menu/DownloadMenuButton.tsx
 *
 * "Download Menu" — আগে `/order`-এ পাঠাত (কিছুই download হতো না); এখন সত্যিকারের
 * PDF নামায় (`GET /api/menu/pdf`)।
 *
 * কেন plain `<a download>` নয়: তাহলে ক্লিকের পর গ্রাহক কিছুই দেখতেন না —
 * server PDF বানানোর ১-২ সেকেন্ড বোতাম অনড়, তারপর হঠাৎ ফাইল। আর server
 * ভেঙে গেলে browser একটা JSON error-ই "download" করে ফেলত। fetch করে
 * নিজে blob বানালে তিনটে অবস্থাই দেখানো যায়:
 *
 *   idle     → "Download Menu"       (↓ আইকন, hover-এ নামে)
 *   loading  → "Preparing menu…"     (spinner + ভেতরে ভরাট হতে থাকা ফিল)
 *   done     → "Menu saved"          (✓, কালো পটভূমি; ২.৫ সেকেন্ড পর ফেরে)
 *   error    → toast + বোতাম আবার চাপা যায়
 *
 * ⚠️ ন্যূনতম ৫০০ms loading — cache-হিট হলে PDF ৫০ms-এ চলে আসে, আর তখন
 * বোতাম এক ঝলকে idle→done হলে গ্রাহক বোঝেনই না কিছু ঘটেছে। ইচ্ছাকৃত।
 *
 * ⚠️ `prefers-reduced-motion` মানা হয়: ফিল-অ্যানিমেশন আর আইকনের সরানো বাদ,
 * অবস্থা বদলের লেখা/আইকন থাকে।
 */

const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

const MIN_LOADING_MS = 500;
const DONE_VISIBLE_MS = 2500;

type Status = "idle" | "loading" | "done";

const LABEL: Record<Status, string> = {
  idle: "Download Menu",
  loading: "Preparing menu\u2026",
  done: "Menu saved",
};

function filenameFrom(response: Response) {
  const header = response.headers.get("Content-Disposition") ?? "";
  return /filename="([^"]+)"/.exec(header)?.[1] ?? "cuisine-menu.pdf";
}

export default function DownloadMenuButton({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const reduceMotion = useReducedMotion();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrl = useRef<string | null>(null);

  // unmount-এর পর timer/URL ছেড়ে দেওয়া।
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    []
  );

  const handleClick = useCallback(async () => {
    if (status === "loading") return; // দুবার চাপলে দুটো ফাইল নয়
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setStatus("loading");

    try {
      const [response] = await Promise.all([
        fetch("/api/menu/pdf", { headers: { Accept: "application/pdf" } }),
        new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
      ]);

      if (!response.ok) {
        // route সবসময় { error } JSON দেয়; না পেলে সাধারণ বার্তা।
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not prepare the menu. Please try again.");
      }

      const blob = await response.blob();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;

      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(response);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus("done");
      resetTimer.current = setTimeout(() => setStatus("idle"), DONE_VISIBLE_MS);
    } catch (error) {
      setStatus("idle");
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not download the menu. Please check your connection and try again."
      );
    }
  }, [status]);

  const isDone = status === "done";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-busy={status === "loading"}
      className={`group relative flex h-[52px] min-w-[196px] items-center justify-center gap-2 overflow-hidden rounded-[90px] border border-black px-6 font-sora text-[15px] font-semibold leading-[1.6] transition-colors xl:h-14 ${FOCUS_RING} ${
        isDone ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
      } ${className}`}
    >
      {/* ভেতরের ফিল: loading-এ ধীরে ৯০%-এ ওঠে, done-এ ১০০%। */}
      <AnimatePresence>
        {status === "loading" && (
          <motion.span
            key="fill"
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-[#FF9540]/25"
            initial={{ scaleX: reduceMotion ? 0.9 : 0 }}
            animate={{ scaleX: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {status === "idle" && (
            <motion.span
              key="download"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              transition={{ duration: 0.18 }}
              className="flex transition-transform duration-200 group-hover:translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
            >
              <Download className="h-[18px] w-[18px]" strokeWidth={2} />
            </motion.span>
          )}
          {status === "loading" && (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2} />
            </motion.span>
          )}
          {isDone && (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="flex"
            >
              <Check className="h-[18px] w-[18px] text-[#FF9540]" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <span className="relative">{LABEL[status]}</span>

      {/* screen reader-কে অবস্থার খবর — বোতামের লেখা বদলালে সব reader নিজে পড়ে না। */}
      <span className="sr-only" role="status" aria-live="polite">
        {status === "loading" ? "Preparing your menu" : isDone ? "Menu downloaded" : ""}
      </span>
    </button>
  );
}
