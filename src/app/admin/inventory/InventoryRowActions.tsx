"use client";

import { useState } from "react";
import IngredientFormModal, {
  type IngredientDraft,
  type SupplierOption,
} from "./IngredientFormModal";
import RestockModal from "./RestockModal";

/**
 * src/app/admin/inventory/InventoryRowActions.tsx
 *
 * Figma-র সারির ডান প্রান্তে একটাই বোতাম: "Restock" (98×50, gradient)।
 *
 * ⚠️ "Edit" বোতামটা নকশায় নেই, তবু আছে — একটা সরু লেখা-লিঙ্ক হিসেবে,
 * নামের নিচে নয় বরং Restock-এর পাশে। কারণ ছাড়া উপায় নেই: max
 * capacity, শ্রেণি, দুটো সীমা — এগুলো কেবল "Add Ingredient" modal-এ
 * লেখা যায়, আর একবার তৈরি হয়ে গেলে সেগুলো বদলানোর কোনো পথ থাকত না।
 * designer সম্ভবত ধরে নিয়েছিলেন সারিতে click করলেই edit খুলবে, কিন্তু
 * তাহলে Restock বোতামে click করাও edit খুলে ফেলার ঝুঁকি তৈরি করত।
 */
export default function InventoryRowActions({
  item,
  suppliers,
  currency,
}: {
  item: IngredientDraft;
  suppliers: SupplierOption[];
  /** দুটো modal-ই "Total Cost" দেখায়, তাই দুজায়গাতেই পাঠাতে হয়। */
  currency: string;
}) {
  const [mode, setMode] = useState<null | "restock" | "edit">(null);

  return (
    <>
      {/**
       * Figma Frame 2147236283 — বোতামজোড়া, row, gap 12, justify flex-end।
       *
       *   < ৫৬০px  → কার্ডটা একটামাত্র কলাম, তাই সবার নিচে।
       *   ৫৬০–১২৭৯ → দুই কলামের grid, বোতাম **উপরের সারির ডানে**,
       *              নামের ঠিক পাশে (Frame 2147236696: row,
       *              `justify-content: space-between`, উচ্চতা 50)।
       *   ≥ ১২৮০   → grid ছেড়ে flex, placement নিষ্ক্রিয়, সারির শেষ ঘর।
       *
       * ⚠️ Figma-র ট্যাবলেট frame-এ কেবল "Restock" আঁকা, Edit নেই —
       * কিন্তু Frame 2147236283-এর `gap: 12px` বলে দেয় ওখানে একাধিক
       * বোতাম বসার কথা, আর desktop frame-এ জোড়াটা আছেই। তাই Edit
       * বাদ দেওয়া হয়নি, Restock-এর বাঁয়ে রাখা হয়েছে — একটা কাজ
       * কেবল পর্দার মাপের কারণে হারিয়ে যাওয়া উচিত নয়।
       */}
      <div className="flex shrink-0 items-center justify-end gap-3 min-[560px]:col-start-2 min-[560px]:row-start-1 xl:col-auto xl:row-auto">
        {/**
         * Figma: 86×50, radius 100, border 1px #000000, লেখা Sora 400
         * 16px #000000, padding 16।
         *
         * ⚠️ আগে এটা নিছক আন্ডারলাইন-করা লেখা ছিল, pill নয়। ফলে
         * পাশের ভরাট "Restock"-এর তুলনায় এটাকে বোতামই মনে হতো না —
         * অথচ কাজ দুটো সমান গুরুত্বের, শুধু একটা প্রধান আর একটা
         * গৌণ। Figma-র ভাষায় সেই তফাতটা ভরাট-বনাম-রেখা, লেখা-বনাম-বোতাম
         * নয়। Staff/Suppliers-এর সারিতেও ঠিক এই জোড়াটাই আছে।
         *
         * ⚠️ `min-w-[86px]` — কারণ Figma-র দুটো মাপ পরস্পরবিরোধী।
         * "Edit" ১৬px Sora-তে ৩২.৪px, তাই padding 16 ধরলে বোতাম হয়
         * ৬৪.৪px, অথচ frame-এ লেখা `width: 86px`। (মিলিয়ে দেখলাম:
         * "Restock" ৬৬.১px, padding 16 সহ ৯৮.১ — Figma-র ৯৮-এর সাথে
         * হুবহু মেলে, অর্থাৎ ওখানে হিসাবটা ঠিক আছে।) দুটোই মানতে হলে
         * padding ১৬ রেখে সর্বনিম্ন প্রস্থ ৮৬ — designer বোতামটাকে
         * ইচ্ছাকৃতভাবে চওড়া করেছেন, আর দুটো বোতাম পাশাপাশি থাকলে
         * সমান-উচ্চতার জোড়াটা এতে দেখতেও ভালো লাগে।
         */}
        <button
          type="button"
          onClick={() => setMode("edit")}
          aria-label={`Edit ${item.name}`}
          className="flex h-[50px] min-w-[86px] shrink-0 items-center justify-center rounded-full border border-black px-4 font-sora text-[16px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Edit
        </button>

        {/**
         * Figma: 98×50, radius 100, লেখা Sora 400 16px সাদা,
         * `linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)`।
         *
         * ⚠️ `bg-gradient-to-r` দিয়ে এটা হয় না: ওই utility মানে ঠিক
         * 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
         * গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**।
         */}
        <button
          type="button"
          onClick={() => setMode("restock")}
          aria-label={`Restock ${item.name}`}
          className="flex h-[50px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] px-4 font-sora text-[16px] font-normal leading-none text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
        >
          Restock
        </button>
      </div>

      {/* ⚠️ modal দুটো কেবল দরকার হলে render হয়। তালিকায় ৮০টা উপকরণ
          মানে ৮০ জোড়া modal — সবগুলো mount থাকলে প্রতিটা নিজের
          state, effect আর listener বয়ে বেড়াত। */}
      {mode === "restock" && (
        <RestockModal
          open
          onClose={() => setMode(null)}
          item={item}
          suppliers={suppliers}
          currency={currency}
        />
      )}
      {mode === "edit" && (
        <IngredientFormModal
          open
          onClose={() => setMode(null)}
          item={item}
          suppliers={suppliers}
          currency={currency}
        />
      )}
    </>
  );
}
