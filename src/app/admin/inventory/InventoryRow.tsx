import StockBar from "@/components/admin/StockBar";
import { STOCK_STATE_STYLE, stockStateOf } from "@/lib/inventory-status";
import InventoryRowActions from "./InventoryRowActions";
import type { IngredientDraft, SupplierOption } from "./IngredientFormModal";

/**
 * src/app/admin/inventory/InventoryRow.tsx
 *
 * Figma Frame 2147236295 — একটা উপকরণের সারি: নাম + "Used in N menu
 * items", stock bar, সরবরাহকারী, status pill, Restock।
 *
 * ⚠️ আলাদা component, কারণ এটা **দুই জায়গায়** বসে: Inventory পাতার
 * শ্রেণি-ভাগগুলোয়, আর "View Emergency Items" পাতায়। কপি রাখলে যা
 * হয় সেটা এই প্রজেক্টেই একবার হয়েছে (FilterMenu.tsx-এর মন্তব্য
 * দ্রষ্টব্য) — একটায় নকশা বদলালে অন্যটা নীরবে পিছিয়ে পড়ে।
 */
export type InventoryRowItem = IngredientDraft & { supplierName: string | null };

export default function InventoryRow({
  item,
  suppliers,
  currency,
}: {
  item: InventoryRowItem;
  suppliers: SupplierOption[];
  /** Restock/Edit modal-এর "Total Cost" ঘরটার জন্য — নিচে চলে যায়। */
  currency: string;
}) {
  const state = stockStateOf(item);
  const badge = STOCK_STATE_STYLE[state];

  return (
    /**
     * Figma Frame 2147236299 (ট্যাবলেট): column, padding 16, gap 16,
     * radius 16, BG #F9F6F3 — ভেতরে **দুটো** সারি:
     *
     *   সারি ১ (h 50): নাম + "Used in N"  ……  Edit · Restock
     *   সারি ২ (h 54): bar + পরিমাণ  |  Supplier  |  status pill
     *
     * ⚠️ ৫৬০ থেকে কার্ডটা দুই কলামের grid, যাতে বোতামজোড়া উপরের
     * সারির ডানে নামের পাশে বসতে পারে। আগে placement ছিল না, তাই
     * ওরা DOM-ক্রমেই সবার নিচে ঝুলত আর কার্ডটা অকারণে লম্বা হতো —
     * Staff আর Suppliers-এর সারিতে এটা আগেই একইভাবে ঠিক করা হয়েছে।
     *
     * ⚠️ base-এ `items-center` নেই, ইচ্ছাকৃত: flex-col-এ ওটা মানে
     * প্রতিটা সন্তান নিজের লেখার মাপে সংকুচিত, তাহলে bar-এর সারিটা
     * পুরো প্রস্থ পেত না।
     */
    <div className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 min-[560px]:grid min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-center xl:flex xl:flex-row xl:items-center xl:gap-8 2xl:gap-[38px]">
      {/* Frame 2147236287: নাম + recipe গণনা, চওড়া 187। */}
      <div className="flex min-w-0 flex-col gap-1 min-[560px]:col-start-1 min-[560px]:row-start-1 xl:col-auto xl:row-auto xl:w-[187px] xl:shrink-0">
        <p className="truncate font-frank-ruhl text-[20px] font-medium leading-[1.2] text-black">
          {item.name}
        </p>
        <p className="truncate font-sora text-[12px] leading-[1.7] text-black/70">
          Used in {item.usedInRecipes} menu {item.usedInRecipes === 1 ? "item" : "items"}
        </p>
      </div>

      {/**
       * Frame 2147236288 — bar, সরবরাহকারী, pill।
       *
       * ⚠️ প্রস্থগুলো `minmax(0, Nfr)` grid, flex নয়। প্রতিটা সারি
       * আলাদা container, তাই content-নির্ভর প্রস্থে (flex-basis auto)
       * এক সারির "Suppler" আরেক সারির সাথে মিলত না — Staff-এর
       * তালিকায় ঠিক এই সমস্যাটাই ধরা পড়েছিল। `fr` ভাগ হয় কেবল
       * উপলব্ধ জায়গা আর অনুপাত থেকে, ভেতরের লেখা থেকে নয়।
       *
       * ⚠️ ৫৬০ থেকে তিনটেই এক সারিতে (Figma-র অনুপাত 259.5 : 113 : 109),
       * আগের মতো দুই কলাম নয় — নাহলে pill-টা একা তৃতীয় সারিতে নেমে
       * যেত আর কার্ডটা Figma-র ১৫২px-এর বদলে অনেক লম্বা হতো।
       *
       * ⚠️ শেষ কলামটা `minmax(114px, 109fr)` — একমাত্র জায়গা যেখানে
       * ন্যূনতম মাপটা px-এ, আর কারণ আছে। pill-এর লেখা সবচেয়ে লম্বা
       * হয় "Out of Stock"-এ: ১৪px Sora-তে ৮৯.৬ + দুপাশে ১২ = ১১৩.৬px।
       * খাঁটি `fr`-এ ৫৬০px পর্দায় ওই কলাম পেত ৯৬px, অর্থাৎ ঠিক যে
       * অবস্থাটা সবচেয়ে জরুরি সেটারই লেখা কেটে যেত। অনুপাত ধরে রাখা
       * ভালো, কিন্তু "Out of Stock" পড়া না যাওয়ার চেয়ে নয়।
       */}
      <div className="grid grid-cols-1 gap-4 min-[560px]:col-span-2 min-[560px]:row-start-2 min-[560px]:grid-cols-[minmax(0,260fr)_minmax(0,113fr)_minmax(114px,109fr)] min-[560px]:items-center xl:col-auto xl:row-auto xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,260fr)_minmax(0,140fr)_minmax(0,120fr)] xl:items-center xl:gap-8">
        <StockBar
          state={state}
          currentStock={item.currentStock}
          maxCapacity={item.maxCapacity}
          unit={item.unit}
        />

        {/* Figma-তে label-টা "Suppler" — বানান ভুল, তাই "Supplier"। */}
        <div className="flex min-w-0 flex-col gap-3">
          <span className="whitespace-nowrap font-sora text-[13px] font-normal leading-none text-black/70 xl:text-[14px]">
            Supplier
          </span>
          <span className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
            {item.supplierName ?? "—"}
          </span>
        </div>

        {/* Figma: উচ্চতা 36, padding 11×12, radius 100, Sora 400 14px। */}
        <span
          /* ⚠️ ৫৬০–১২৭৯-তে pill-টা নিজের কলামের **ডান** কিনারায়, কারণ
             ওটাই সারির শেষ জিনিস আর Figma-তে কার্ডের ডান কিনারা ধরে
             বসে। xl-এ এর পরে আরও ঘর আছে, তাই সেখানে বাঁ-ঘেঁষাই ঠিক। */
          className={`flex h-9 w-fit items-center justify-center rounded-full px-3 font-sora text-[14px] font-normal leading-none min-[560px]:justify-self-end xl:justify-self-auto ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <InventoryRowActions item={item} suppliers={suppliers} currency={currency} />
    </div>
  );
}
