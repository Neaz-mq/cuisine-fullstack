"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * src/components/landing/LiveKitchenModal.tsx
 *
 * "Live Kitchen" একটা পাতা নয়, একটা action — ভিডিও দেখা। Industry
 * standard তাই navigation নয়, dialog: ব্যবহারকারী পাতা ছেড়ে না গিয়েই
 * দেখে আবার ফিরে আসে। (Banner.tsx-এও একই ভিডিও modal-এ খোলে।)
 *
 * ── Smooth অভিজ্ঞতা ───────────────────────────────────────────────
 *  1. খোলা: কালো backdrop ধীরে ফুটে ওঠে (+ হালকা blur), card নিচ থেকে
 *     একটু উঠে আসে আর 96% → 100% বড় হয়। বন্ধ: উল্টোটা, একটু দ্রুত
 *     (বের হওয়া এলে চটপট হওয়াই ভালো লাগে)।
 *  2. ভিডিও লোডের সময় ফাঁকা কালো বাক্স নয় — spinner। iframe-এর
 *     onLoad হলে ভিডিও fade-in করে, হঠাৎ "ঝপ" করে ফুটে ওঠে না।
 *  3. পেছনের scrollbar মিলিয়ে যাওয়ায় পাতা যে ডানে লাফ দেয় (layout
 *     shift), সেটা ঠেকাতে scrollbar-এর সমান padding বসানো হয়।
 *  4. prefers-reduced-motion থাকলে নড়াচড়া বন্ধ, শুধু ধীর fade।
 *
 * ── যা আগে থেকেই ছিল ──────────────────────────────────────────────
 *  • role="dialog" + aria-modal, Esc / backdrop-এ ক্লিকে বন্ধ
 *  • focus trap, বন্ধ হলে আগের বোতামে focus ফেরত
 *  • youtube-nocookie.com, iframe শুধু খোলার পর তৈরি (বন্ধ করলে মুছে
 *    যায়, তাই ভিডিও থেমে যায়)
 *  • createPortal → body: framer-motion-এর transform থাকা parent-এর
 *    ভেতরে `fixed` ভুল জায়গায় বসে
 */

/** YouTube video id — Banner.tsx-এ যেটা আছে সেটাই। */
const LIVE_KITCHEN_VIDEO_ID = "LVI8veUnSLQ";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function LiveKitchenModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // SSR-এ document নেই; client-এ বসার পরই portal বানানো যায়।
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // iframe লোড শেষ হয়েছে কিনা — spinner ↔ ভিডিওর fade-এর জন্য।
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => {
    if (open) setVideoReady(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Scroll lock — scrollbar-এর চওড়া জায়গাটা padding দিয়ে ভরে দিই,
    // নাহলে scrollbar উবে গিয়ে পুরো পাতা ~15px ডানে লাফ দেয়।
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: modal-এর focusable জিনিসগুলোর মধ্যেই ঘুরবে।
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], iframe, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="live-kitchen-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.3, ease: "easeOut" }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Live Kitchen video"
            className="relative w-full max-w-4xl"
            // ভেতরে ক্লিক করলে backdrop-এর onClose চালু হবে না।
            onClick={(e) => e.stopPropagation()}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } }
            }
            transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: EASE }}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform duration-200 hover:scale-110 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              {/* লোডিং spinner — ভিডিও তৈরি হলে মিলিয়ে যায়। */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
                  videoReady ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-[#FF9540]" />
              </div>

              <iframe
                className={`h-full w-full transition-opacity duration-700 ease-out ${
                  videoReady ? "opacity-100" : "opacity-0"
                }`}
                src={`https://www.youtube-nocookie.com/embed/${LIVE_KITCHEN_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title="Live Kitchen"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                onLoad={() => setVideoReady(true)}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}