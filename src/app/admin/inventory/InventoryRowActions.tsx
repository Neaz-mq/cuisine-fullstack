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
}: {
  item: IngredientDraft;
  suppliers: SupplierOption[];
}) {
  const [mode, setMode] = useState<null | "restock" | "edit">(null);

  return (
    <>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("edit")}
          aria-label={`Edit ${item.name}`}
          className="font-sora text-[14px] font-normal leading-none text-black/70 underline-offset-2 transition-colors hover:text-black hover:underline focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]"
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
        <RestockModal open onClose={() => setMode(null)} item={item} suppliers={suppliers} />
      )}
      {mode === "edit" && (
        <IngredientFormModal
          open
          onClose={() => setMode(null)}
          item={item}
          suppliers={suppliers}
        />
      )}
    </>
  );
}
