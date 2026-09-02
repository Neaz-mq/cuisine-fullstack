"use client";

// ⚠️ useEffect/useRef আর লাগে না — ওগুলো SupplierProductsPill-এর
// ছিল, আর সেটা এখন নিজের ফাইলে। না সরালে no-unused-vars ভাঙত।
import { useState } from "react";
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
      {/**
       * Figma Frame 2147236374 — বোতামজোড়া, তিন পর্দায় তিন জায়গা:
       *
       *   < ৫৬০px  → কার্ডটা একটামাত্র কলাম, তাই সবার নিচে ডান কোণে।
       *              placement class লাগে না — flex-col-এর শেষ সন্তান,
       *              ভেতরের `justify-end` বোতামদুটোকে ডানে ঠেলে।
       *   ৫৬০–১২৭৯ → দুই কলামের grid, বোতাম **উপরের সারির ডানে**,
       *              নাম/ইমেইলের ঠিক পাশে (Figma Frame 2147236690:
       *              row, `justify-content: space-between`, উচ্চতা 48)।
       *   ≥ ১২৮০   → grid ছেড়ে flex, placement নিষ্ক্রিয়, সারির শেষ ঘর।
       *
       * ⚠️ ট্যাবলেটে এটাই আগে ভুল ছিল: কোনো placement না থাকায়
       * বোতামজোড়া DOM-ক্রমেই তৃতীয় সন্তান হিসেবে কার্ডের একেবারে
       * নিচে ঝুলে থাকত, আর তার উপরে একটা বড় ফাঁকা জায়গা তৈরি হতো।
       * Staff-এর সারিতে এটা আগেই ঠিক করা হয়েছে, একই উপায়ে।
       */}
      <div className="flex shrink-0 items-center justify-end gap-2 min-[560px]:col-start-2 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[120px]">
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
