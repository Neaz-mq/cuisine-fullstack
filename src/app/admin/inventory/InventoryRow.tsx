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
    /* Figma: row, space-between, padding 16, উচ্চতা 86, radius 16,
       BG #F9F6F3। */
    <div className="flex flex-col gap-4 rounded-[16px] bg-[#F9F6F3] p-4 xl:flex-row xl:items-center xl:gap-8 2xl:gap-[38px]">
      {/* Frame 2147236287: নাম + recipe গণনা, চওড়া 187। */}
      <div className="flex min-w-0 flex-col gap-1 xl:w-[187px] xl:shrink-0">
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
       */}
      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:min-w-0 xl:flex-1 xl:grid-cols-[minmax(0,260fr)_minmax(0,140fr)_minmax(0,120fr)] xl:items-center xl:gap-8">
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
          className={`flex h-9 w-fit items-center justify-center rounded-full px-3 font-sora text-[14px] font-normal leading-none ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <InventoryRowActions item={item} suppliers={suppliers} currency={currency} />
    </div>
  );
}
