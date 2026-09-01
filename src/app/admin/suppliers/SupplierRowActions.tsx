"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import SupplierFormModal, { type SupplierDraft } from "./SupplierFormModal";
import ViewSupplierModal from "./ViewSupplierModal";

/**
 * src/app/admin/suppliers/SupplierRowActions.tsx
 *
 * Figma-র সারির ডান প্রান্তের বোতাম — Staff-এর সারির হুবহু একই জোড়া:
 * "Edit" (সাদা, কালো পাড়ের pill) আর "View" (কমলা→গোলাপি gradient pill)।
 *
 * ⚠️ Figma-তে এখানে একটাই বোতাম আঁকা, আর প্রথম দফায় আমিও একটাই
 * রেখেছিলাম — এই যুক্তিতে যে সরবরাহকারীর সব ঘর সারিতেই দেখা যায়,
 * তাই "View" খুললে নতুন কিছু পাওয়া যেত না।
 *
 * যুক্তিটার প্রথম অংশ এখনো ঠিক, কিন্তু উপসংহারটা ছিল ভুল। View
 * modal-টা ওই ঘরগুলো আবার দেখানোর জন্য নয় — ওটা দেখায় **সরবরাহের
 * ইতিহাস**: কতগুলো অর্ডার, শেষ মাল কবে এসেছে, কতগুলো আলাদা পণ্য।
 * ওগুলো সারিতে রাখা যেত না (সারিপ্রতি আলাদা query লাগত), অথচ
 * "এই সরবরাহকারী কেমন" প্রশ্নের উত্তর ওখানেই।
 *
 * সেই সাথে দুই পাতার সারি এখন একই আচরণ করে — ব্যবহারকারীকে দুটো
 * আলাদা নিয়ম মনে রাখতে হয় না।
 */
export default function SupplierRowActions({ supplier }: { supplier: SupplierDraft }) {
  const [mode, setMode] = useState<null | "view" | "edit">(null);

  return (
    <>
      {/* Figma Frame 2147236374: row, justify flex-end, gap 8, উচ্চতা 40।

          ⚠️ xl-এ প্রস্থটা স্থির (১২০), hug নয় — Staff-এর সারির একই
          কারণ: hug হলে এই ব্লকটার প্রস্থ লেখার উপর নির্ভর করত আর
          তার বাঁ পাশের কলামগুলো সারিভেদে সরে যেত। */}
      <div className="flex shrink-0 items-center justify-end gap-2 xl:w-[120px]">
        {/**
         * Figma: 53×40, padding 13×12, radius 100।
         *
         * ⚠️ প্রথমে এটা gradient-এ বসানো হয়েছিল, কারণ Figma-র
         * সরবরাহকারী-সারিতে বোতামটা gradient-এই আঁকা। কিন্তু তাতে
         * দুই পাতার একই কাজের বোতাম দুই রকম দেখাত: Staff-এর সারিতে
         * "Edit" সাদা-কালো পাড়ের pill, আর gradient-টা "View"-এর জন্য
         * তোলা।
         *
         * এই প্রজেক্টে gradient একটা **অর্থ** বহন করে — পাতার প্রধান
         * কাজ (Add New, View, Restock)। "Edit" প্রধান কাজ নয়, সহায়ক।
         * দুই পাতায় একই কাজ একই চেহারায় থাকাটা designer-এর ওই
         * একটা frame-এর সাথে মেলার চেয়ে বেশি জরুরি — নাহলে
         * ব্যবহারকারী শেখেন "কমলা মানে প্রধান কাজ", তারপর এক পাতায়
         * সেটা মেলে না।
         *
         * class-গুলো StaffRowActions-এর "Edit" বোতামের হুবহু অনুলিপি।
         */}
        <button
          type="button"
          onClick={() => setMode("edit")}
          aria-label={`Edit ${supplier.name}`}
          className="flex h-10 items-center justify-center rounded-full border border-black px-3 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Edit
        </button>

        {/**
         * Figma: 59×40, পাড় নেই, সাদা লেখা,
         * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)` —
         * StaffRowActions-এর "View" বোতামের হুবহু অনুলিপি।
         *
         * ⚠️ `bg-gradient-to-r` দিয়ে এটা হয় না: ওই utility মানে ঠিক
         * 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
         * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**।
         */}
        <button
          type="button"
          onClick={() => setMode("view")}
          aria-label={`View ${supplier.name}`}
          className="flex h-10 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-3 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          View
        </button>
      </div>

      {/* কেবল দরকার হলে render — দশটা সারি মানে দশ জোড়া modal,
          সবগুলো mount থাকলে প্রতিটা নিজের effect আর listener বয়ে
          বেড়াত। */}
      {mode === "view" && (
        <ViewSupplierModal
          open
          onClose={() => setMode(null)}
          supplierId={supplier.id}
          // ⚠️ View থেকে Edit-এ যাওয়া মানে আগেরটা **বন্ধ** করে পরেরটা
          // খোলা, দুটো একসাথে নয় — নাহলে দুটো modal একের উপর আরেক
          // বসত আর Escape চাপলে কোনটা বন্ধ হতো সেটা অনিশ্চিত থাকত।
          onEdit={() => setMode("edit")}
        />
      )}
      {mode === "edit" && (
        <SupplierFormModal open onClose={() => setMode(null)} supplier={supplier} />
      )}
    </>
  );
}

/**
 * Figma-র "Products" ঘর — সাদা pill, ভেতরে একটা পণ্যের নাম আর একটা
 * ১৬px chevron (Frame 2147236294)।
 *
 * ── এটা ছাঁকনি নয় ───────────────────────────────────────────────────
 *
 * ⚠️ দেখতে dropdown, কিন্তু কিছু বাছাই করা যায় না — এটা নিছক একটা
 * তালিকা যেটা জায়গা বাঁচাতে গুটিয়ে রাখা। একজন সরবরাহকারী দশরকম পণ্য
 * দিতে পারেন, আর দশটা নাম এক সারিতে ধরানো যায় না।
 *
 * ⚠️ নামগুলো `Supplier.products` থেকে — অর্থাৎ modal-এ হাতে লেখা
 * "কী কী দিতে পারেন"। আগে এগুলো purchase order-এর line item থেকে
 * বের করা হতো ("কী কী এসেছে"), কিন্তু Figma-র modal-এ ঘরটা যোগ হওয়ায়
 * এখন উৎস একটাই। দুটোর তফাত আছে: নতুন সরবরাহকারীর কোনো অর্ডার নেই,
 * অথচ তিনি কী দেন সেটা জানা থাকে।
 *
 * Figma-তে pill-এ একটাই নাম দেখানো, কিন্তু সেটা designer-এর নমুনা।
 * বাস্তবে একাধিক থাকলে "Chicken +3" দেখানো হয়, নাহলে ব্যবহারকারী
 * ভাবতেন ওই একটাই পণ্য আসে।
 */
export function SupplierProductsPill({ products }: { products: string[] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (products.length === 0) {
    // "—", ফাঁকা pill নয়: একটা খালি বাক্স দেখে বোঝা যেত না ওটা
    // ভরাট হয়নি না ভাঙা।
    return <span className="font-frank-ruhl text-[16px] font-medium text-black">—</span>;
  }

  const [first, ...rest] = products;

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Figma: 94×36, padding 10×12, gap 4, radius 100, BG সাদা,
          লেখা Sora 400 12px। */}
      <button
        type="button"
        onClick={() => rest.length > 0 && setOpen((prev) => !prev)}
        aria-expanded={rest.length > 0 ? open : undefined}
        // একটাই পণ্য হলে খোলার কিছু নেই — তখন এটা নিছক একটা লেবেল,
        // তাই cursor-ও বদলায় না।
        className={`flex h-9 max-w-full items-center gap-1 rounded-full bg-white px-3 font-sora text-[12px] font-normal leading-none text-black ${
          rest.length > 0 ? "cursor-pointer" : "cursor-default"
        } focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]`}
      >
        <span className="min-w-0 truncate">{first}</span>
        {rest.length > 0 && (
          <>
            <span className="shrink-0 text-black/50">+{rest.length}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-black transition-transform ${
                open ? "rotate-180" : ""
              }`}
              strokeWidth={1.2}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        /* FilterMenu-র popup-এর একই চেহারা: সাদা কার্ড, padding 16,
           radius 16, ছায়া 0 4px 30px rgba(0,0,0,0.06)। */
        <ul className="absolute left-0 top-full z-30 mt-2 flex max-h-[180px] w-max min-w-full max-w-[240px] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-[0_4px_30px_rgba(0,0,0,0.06)]">
          {products.map((product) => (
            <li
              key={product}
              className="truncate rounded-[12px] p-2.5 font-sora text-[14px] font-normal leading-none text-[#121212]"
            >
              {product}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
