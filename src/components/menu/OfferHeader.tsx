"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "react-toastify";

/**
 * src/components/menu/OfferHeader.tsx
 *
 * Figma Frame 2147236051 — ছাড়ের পাতার মাথা: বাঁয়ে "New Here 20% OFF"
 * (Frank Ruhl 600 40px), ডানে "Apply Voucher" (Sora 400 20px, Black/70)।
 *
 * ⚠️ "Apply Voucher" নকশায় নিছক লেখা, কিন্তু এখানে সেটা একটা বোতাম —
 * চাপলে কোডটা clipboard-এ চলে যায়। কারণ কোডটা "প্রয়োগ" করার আসল
 * জায়গা checkout, আর এই পাতা থেকে সেখানে টেনে নিয়ে যাওয়া মানে
 * খদ্দেরের বাছাই করা শেষ হওয়ার আগেই তাঁকে সরিয়ে দেওয়া। কোড কপি করে
 * রাখাটাই এখানে সবচেয়ে কাজের — checkout-এ গিয়ে তিনি শুধু paste করবেন।
 *
 * ⚠️ `navigator.clipboard` HTTPS (বা localhost) ছাড়া থাকে না, আর
 * ব্যবহারকারী অনুমতি না দিলেও ব্যর্থ হয়। তাই ব্যর্থ হলে কোডটা
 * toast-এ দেখানো হয় — অন্তত হাতে টুকে নেওয়া যায়, নীরবে কিছু না
 * হওয়ার চেয়ে ভালো।
 */
export default function OfferHeader({
  title,
  code,
}: {
  /** "Pizza 20% OFF" — কুপন থেকে বানানো। */
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Code ${code} copied — paste it at checkout.`);
      // দু'সেকেন্ড পরে আবার আগের চেহারায়, নাহলে টিকটা চিরকাল
      // বসে থাকত আর পরেরবার কপি হয়েছে কিনা বোঝা যেত না।
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Use code ${code} at checkout.`);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between min-[560px]:gap-[60px]">
      <h1 className="font-frank-ruhl text-[24px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[32px] xl:text-[40px]">
        {title}
      </h1>

      <button
        type="button"
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-2 font-sora text-[14px] font-normal leading-[1.14] tracking-[-0.01em] text-black/70 underline-offset-4 transition-colors hover:text-black hover:underline focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px] md:text-[16px] xl:text-[20px]"
      >
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-[#0ECF00]" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        )}
        {copied ? "Code copied" : "Apply Voucher"}
      </button>
    </div>
  );
}
