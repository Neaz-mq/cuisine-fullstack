"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";

/**
 * src/app/(main)/track/[orderId]/OrderCelebration.tsx
 *
 * অর্ডার পৌঁছে যাওয়ার পর Figma-র দুটো modal, একটার পর একটা:
 *
 *   ১. "Congratulations!"  — 555px, radius 30, padding 30, gap 31
 *      বোতাম: "Go to Home" (কালো outline) · "Food Review" (gradient)
 *   ২. "How Was Your Food Experience?" — 815px, radius 20, padding 60/30
 *      90px cream গোলে কমলা তারা, textarea, "Skip" · "Submit"
 *
 * ⚠️ দুটো আলাদা `<dialog>` নয়, একটাই — শুধু ভেতরের content বদলায়।
 * দুটো dialog একসাথে থাকলে প্রথমটা বন্ধ করে দ্বিতীয়টা খোলার মাঝে এক
 * মুহূর্তের জন্য focus পর্দার কোথাও থাকত না, আর screen reader পুরো
 * প্রসঙ্গটাই হারাত।
 *
 * ── কখন দেখা যায় ────────────────────────────────────────────────────
 *
 * ⚠️ অর্ডারপ্রতি একবার, আর সেটা মনে রাখা হয় localStorage-এ। DB-তে
 * রাখা যেত, কিন্তু তাতে প্রতিটা /track লোডে একটা বাড়তি query লাগত
 * শুধু "এই উৎসবটা কি আগে দেখানো হয়েছে" জানতে — অথচ ভুল হলে সবচেয়ে
 * খারাপ যা হয় তা হলো গ্রাহক অন্য ব্রাউজারে আরেকবার অভিনন্দন দেখেন।
 *
 * ⚠️ localStorage সব পরিবেশে থাকে না (private mode, storage বন্ধ করা
 * ব্রাউজার), তাই প্রতিটা ডাক try/catch-এ। ব্যর্থ হলে আচরণ হয় "মনে নেই"
 * — modal আবার দেখাবে, কিন্তু পাতা ভাঙবে না।
 */

const SEEN_KEY = (orderId: string) => `order-celebrated:${orderId}`;

export function hasSeenCelebration(orderId: string): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY(orderId)) === "1";
  } catch {
    return false;
  }
}

function rememberCelebration(orderId: string) {
  try {
    window.localStorage.setItem(SEEN_KEY(orderId), "1");
  } catch {
    // storage বন্ধ — পরের বার আবার দেখাবে, সেটাই সবচেয়ে খারাপ ফল।
  }
}

type Step = "congrats" | "review";

export default function OrderCelebration({
  open,
  orderId,
  onClose,
}: {
  open: boolean;
  orderId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("congrats");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * Esc-এ browser নিজেই dialog বন্ধ করে, কিন্তু React-এর state সেটা
   * জানে না — `close` event ধরে মিলিয়ে না দিলে state আর DOM আলাদা হয়ে
   * যেত আর modal-টা আর কখনো খুলত না।
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      rememberCelebration(orderId);
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [orderId, onClose]);

  function dismiss() {
    rememberCelebration(orderId);
    onClose();
  }

  async function submitReview() {
    const text = comment.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      });

      if (!res.ok) {
        // ⚠️ server-এর নিজের বার্তাটাই দেখানো হয় — "আগে ডেলিভারি হতে
        // হবে" বা "খুব বেশি চেষ্টা" জাতীয় কারণগুলো ওখান থেকেই আসে, আর
        // সেগুলো ছাড়া গ্রাহক বুঝতেই পারতেন না কী হলো।
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't send your review.");
      }

      toast.success("Thanks for your review!");
      dismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`celebration-title-${orderId}`}
      onClick={(event) => {
        if (event.target === dialogRef.current) dismiss();
      }}
      className={`m-auto w-[calc(100vw-32px)] bg-white p-0 backdrop:bg-black/50 ${
        step === "congrats" ? "max-w-[555px] rounded-[30px]" : "max-w-[815px] rounded-[20px]"
      }`}
    >
      {step === "congrats" ? (
        <div className="flex flex-col items-center gap-6 p-6 text-center md:gap-[31px] md:p-[30px]">
          <CelebrationArt />

          <div className="flex flex-col items-center gap-5">
            <h2
              id={`celebration-title-${orderId}`}
              className="font-frank-ruhl text-[32px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[46px]"
            >
              Congratulations!
            </h2>
            <p className="max-w-[495px] font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
              Thank you for your order. We look forward to welcoming you again with fresh flavors.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 min-[420px]:flex-row">
            {/* ⚠️ `<Link>`, বোতাম নয় — এটা সত্যিই একটা navigation, তাই
                মাঝ-ক্লিক বা নতুন ট্যাবে খোলা কাজ করা উচিত। */}
            <Link
              href="/"
              onClick={dismiss}
              className="flex h-[46px] flex-1 items-center justify-center rounded-full border border-black px-5 font-sora text-[15px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]"
            >
              Go to Home
            </Link>
            <button
              type="button"
              onClick={() => setStep("review")}
              className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]"
            >
              Food Review
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 px-5 py-10 md:gap-[30px] md:px-[30px] md:py-[60px]">
          <div className="flex w-full max-w-[579px] flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-[30px]">
              {/* Figma "Frame 2147236204": 90px cream গোল, ভেতরে 44px তারা। */}
              <span className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#F9F6F3] md:h-[90px] md:w-[90px]">
                <svg
                  className="h-9 w-9 md:h-11 md:w-11"
                  viewBox="0 0 24 24"
                  fill="#FF9540"
                  aria-hidden="true"
                >
                  <path d="M12 2.5l2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.33l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.95L12 2.5Z" />
                </svg>
              </span>

              <div className="flex flex-col items-center gap-3 text-center">
                <h2
                  id={`celebration-title-${orderId}`}
                  className="font-frank-ruhl text-[24px] font-medium leading-[1.2] text-[#121212] md:text-[30px]"
                >
                  How Was Your Food Experience?
                </h2>
                <p className="max-w-[433px] font-sora text-[13px] leading-[1.5] text-[#121212]/60 md:text-[14px]">
                  Tell us what you loved about your meal. Your review helps other food lovers
                  discover our best dishes.
                </p>
              </div>
            </div>

            {/* Figma "Fill": cream, radius 12, padding 12, উচ্চতা 121। */}
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={4}
              aria-label="Your food experience"
              placeholder="Type here your food experience...."
              className="h-[121px] w-full resize-none rounded-[12px] bg-[#F9F6F3] p-3 font-sora text-[13px] leading-[1.6] text-black placeholder:text-black/70 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:-2px] md:text-[14px]"
            />

            <div className="flex w-full max-w-[333px] flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={dismiss}
                className="flex h-[46px] flex-1 items-center justify-center rounded-full border border-black px-5 font-sora text-[15px] font-semibold leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px]"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitReview}
                /* ⚠️ ফাঁকা লেখায় নিষ্ক্রিয় — server-ও সেটা নেবে না
                   (orderReviewSchema), তাই এখানে আটকানো মানে একটা অকারণ
                   round trip আর একটা error toast কম। */
                disabled={submitting || comment.trim().length === 0}
                className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-5 font-sora text-[15px] font-semibold leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] disabled:opacity-50 md:text-[16px]"
              >
                {submitting ? "Sending…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * Figma "Frame 2147225766" — কমলা টিক-চিহ্ন আর চারপাশে confetti।
 *
 * ⚠️ ছবি নয়, inline SVG: আকারটা সরল (গোল, তারা, কয়েকটা রেখা) আর
 * তাতে কোনো নেটওয়ার্ক request লাগে না — modal-টা ঠিক যে মুহূর্তে
 * খোলে সেই মুহূর্তেই পুরোটা দেখা যায়, অর্ধেক আঁকা অবস্থায় নয়।
 */
function CelebrationArt() {
  return (
    <svg
      viewBox="0 0 315 269"
      className="h-[180px] w-[210px] md:h-[268px] md:w-[315px]"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="160" cy="171" r="97" fill="#FEF0E3" />
      <path
        d="M160 94.5l19.6 8.1 21.2 .1 8.1 19.6 15 15-8.1 19.6-.1 21.2-19.6 8.1-15 15-19.6-8.1-21.2-.1-8.1-19.6-15-15 8.1-19.6 .1-21.2 19.6-8.1 15-15Z"
        fill="#FFFFFF"
        stroke="#FA7F12"
        strokeWidth="9.42"
        strokeLinejoin="round"
      />
      <path
        d="M137 170.5l15.5 15.5 25.5-25.5"
        stroke="#FA7F12"
        strokeWidth="9.42"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* confetti — কমলা #FA7F12, গোলাপি #FF70C6 */}
      <path
        d="M54 39c8-12 20-14 27-6s18 6 27-6"
        stroke="#FF5E07"
        strokeWidth="4.7"
        strokeLinecap="round"
      />
      <path
        d="M276 62c7-10 16-11 21-4s13 4 17-4"
        stroke="#FF5E07"
        strokeWidth="4.7"
        strokeLinecap="round"
      />
      <path
        d="M4 118c8-10 17-11 22-4s12 4 16-4"
        stroke="#FF70C6"
        strokeWidth="4.7"
        strokeLinecap="round"
      />
      <path
        d="M283 220c7-9 15-10 20-4s11 3 14-4"
        stroke="#FF70C6"
        strokeWidth="4.7"
        strokeLinecap="round"
      />
      <circle cx="50" cy="91" r="6.3" fill="#FF70C6" />
      <circle cx="287" cy="148" r="12.6" fill="#FA7F12" />
      <circle cx="276" cy="121" r="6.3" fill="#FA7F12" />
      <circle cx="154" cy="3" r="3.1" fill="#FF70C6" />
      <circle cx="168" cy="22" r="14.1" fill="#FF70C6" />
      <path d="M232 8l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="#FF70C6" />
      <path d="M45 185l6 15 15 6-15 6-6 15-6-15-15-6 15-6 6-15Z" fill="#FA7F12" />
    </svg>
  );
}
