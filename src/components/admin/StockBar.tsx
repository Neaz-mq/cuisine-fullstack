import { STOCK_BAR_COLOR, formatQuantity, stockPercent, type StockState } from "@/lib/inventory-status";

/**
 * src/components/admin/StockBar.tsx
 *
 * Figma Frame 2147236438: একটা ১০px উঁচু rail + তার নিচে "1.2 Kg / 15 Kg"।
 *
 * ── rail-টার তির্যক ডোরা ────────────────────────────────────────────
 *
 * ⚠️ Figma-তে এই ডোরাগুলো **৯৬টা আলাদা rectangle**, প্রতিটা ২×৬৫px আর
 * `matrix(0.97, 0.23, -0.77, 0.64, 0, 0)` দিয়ে কাত করা। ওভাবে করলে
 * প্রতিটা সারিতে ৯৬টা DOM node বসত — দশটা সারিতে প্রায় হাজারটা,
 * কেবল একটা পটভূমির নকশার জন্য।
 *
 * `repeating-linear-gradient` হুবহু একই জিনিস আঁকে, একটাও extra node
 * ছাড়া। designer-এর matrix থেকে কোণটা বেরোয় ≈ 55°, ডোরার ব্যবধান
 * ≈ 6px — নিচের মানগুলো সেখান থেকেই।
 *
 * ভরাট অংশটা ডোরার **উপরে** বসে, তাই ডোরা কেবল বাকি (খালি) অংশে
 * দেখা যায় — Figma-তেও ঠিক তাই।
 */
export default function StockBar({
  state,
  currentStock,
  maxCapacity,
  unit,
}: {
  state: StockState;
  currentStock: number;
  maxCapacity: number;
  unit: string;
}) {
  const percent = stockPercent(currentStock, maxCapacity);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {percent === null ? (
        /* ⚠️ ধারণক্ষমতা ঠিক করা না থাকলে bar আঁকা হয় না — কীসের
           তুলনায় ভরাট, সেটাই জানা নেই। একটা মনগড়া সীমা বসিয়ে
           bar দেখানো যেত, কিন্তু তখন সেটা একটা বানানো সংখ্যা হতো।
           বদলে একটা ছোট ইঙ্গিত, যাতে ঘরটা ভরাট করার কথা মনে পড়ে। */
        <p className="font-sora text-[12px] leading-none text-black/40">
          Set a max capacity to see the stock bar
        </p>
      ) : (
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-white"
          style={{
            backgroundImage:
              "repeating-linear-gradient(55deg, #F9F6F3 0 2px, #FFFFFF 2px 6px)",
          }}
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Stock level"
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${percent}%`, backgroundColor: STOCK_BAR_COLOR[state] }}
          />
        </div>
      )}

      {/* Figma: Sora 400 14px #000000। */}
      <p className="truncate font-sora text-[14px] font-normal leading-none text-black">
        {formatQuantity(currentStock, unit)}
        {maxCapacity > 0 && ` / ${formatQuantity(maxCapacity, unit)}`}
      </p>
    </div>
  );
}
