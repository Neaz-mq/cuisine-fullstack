import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/inventory-status.ts
 *
 * /admin/inventory-এর ভাষা: একটা উপকরণ কোন অবস্থায় আছে, কোন শ্রেণিতে
 * পড়ে, আর তার পরিমাণটা পর্দায় কী রূপে দেখা যায়।
 *
 * ── চারটে অবস্থা, আর কেন চারটেই ─────────────────────────────────────
 *
 * schema-য় দুটো সীমা আছে — `reorderThreshold` ("এ সপ্তাহে অর্ডার দাও")
 * আর `emergencyThreshold` ("আজকের অর্ডারগুলোই আটকে যাবে")। সেই দুটো
 * সীমা আর শূন্য মিলিয়ে স্বাভাবিকভাবেই চারটে অবস্থা তৈরি হয়, আর
 * Figma-র চারটে pill ঠিক সেগুলোই।
 *
 * ⚠️ ক্রমটা গুরুত্বপূর্ণ: একটা উপকরণ একই সাথে emergency আর low stock
 * দুটোই হতে পারে (emergency সীমা সবসময় reorder সীমার নিচে)। তাই
 * সবচেয়ে জরুরি অবস্থাটাই আগে যাচাই হয় — নাহলে ফুরিয়ে যাওয়া জিনিস
 * "Low Stock" দেখাত।
 */

export const INVENTORY_STATUSES = [
  "all",
  "in-stock",
  "low",
  "emergency",
  "out",
] as const;

export type InventoryStatusFilter = (typeof INVENTORY_STATUSES)[number];

export const DEFAULT_INVENTORY_STATUS: InventoryStatusFilter = "all";

export function isInventoryStatusFilter(value: unknown): value is InventoryStatusFilter {
  return typeof value === "string" && (INVENTORY_STATUSES as readonly string[]).includes(value);
}

export const INVENTORY_STATUS_OPTIONS: FilterMenuOption<InventoryStatusFilter>[] = [
  // Figma-র pill-এ "All Statuses", popup-এ শুধু "All"।
  { value: "all", label: "All", triggerLabel: "All Statuses" },
  { value: "in-stock", label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "emergency", label: "Emergency" },
  { value: "out", label: "Out of Stock" },
];

/** একটা সারির প্রকৃত অবস্থা — ছাঁকনির "all" এখানে থাকে না। */
export type StockState = "in-stock" | "low" | "emergency" | "out";

export function stockStateOf(item: {
  currentStock: number;
  reorderThreshold: number;
  emergencyThreshold: number;
}): StockState {
  if (item.currentStock <= 0) return "out";
  // ⚠️ emergency আগে — উপরের ক্রমের ব্যাখ্যা দ্রষ্টব্য।
  if (item.emergencyThreshold > 0 && item.currentStock <= item.emergencyThreshold) {
    return "emergency";
  }
  // ⚠️ `> 0` — সীমা ঠিক করা না থাকলে (ডিফল্ট 0) প্রতিটা জিনিসই
  // "low stock" দেখাত, কারণ যেকোনো stock ≥ 0। schema-র মন্তব্যেও
  // এই ফাঁদটার কথা লেখা আছে।
  if (item.reorderThreshold > 0 && item.currentStock <= item.reorderThreshold) return "low";
  return "in-stock";
}

/**
 * Figma-র status pill: উচ্চতা 36, padding 11×12, radius 100,
 * লেখা Sora 400 14px।
 *
 * রঙগুলো designer-এর নিজের hex — সবুজ #E8FFEC/#0ECF00, হলুদ
 * #FFF2DA/#FF9E00, লাল #FAE7EC/#D72A37। "Out of Stock"-এর জন্য
 * Figma-তে সাদা pill আঁকা (#FFFFFF, কালো লেখা), আর সেটাই রাখা হলো:
 * ফুরিয়ে যাওয়া মানে আর কোনো "মাত্রা" নেই, তাই রঙের সতর্কবার্তাও নেই —
 * শূন্যটা নিজেই যথেষ্ট।
 */
export const STOCK_STATE_STYLE: Record<StockState, { label: string; className: string }> = {
  "in-stock": { label: "In Stock", className: "bg-[#E8FFEC] text-[#0ECF00]" },
  low: { label: "Low Stock", className: "bg-[#FFF2DA] text-[#FF9E00]" },
  emergency: { label: "Emergency", className: "bg-[#FAE7EC] text-[#D72A37]" },
  out: { label: "Out of Stock", className: "bg-white text-black" },
};

/**
 * progress bar-এর ভরাট অংশের রঙ — Figma Frame 2147232390।
 *
 * সবুজ #6DCB66, কমলা #FF9540, লাল #FF4040। "Out of Stock"-এ bar-টা
 * সাদা (অর্থাৎ কার্যত অদৃশ্য), কারণ ভরাট করার মতো কিছুই নেই।
 */
export const STOCK_BAR_COLOR: Record<StockState, string> = {
  "in-stock": "#6DCB66",
  low: "#FF9540",
  emergency: "#FF4040",
  out: "#FF4040",
};

/**
 * Figma-র Inventory পাতার শ্রেণি-ভাগ।
 *
 * ⚠️ schema-র enum নয়, শুধু UI-র তালিকা — `InventoryItem.category`
 * একটা free-text column (কারণ schema.prisma-র মন্তব্যে)। এখানে একটা
 * শ্রেণি যোগ বা বাদ দিতে কোনো migration লাগে না, আর পুরনো উপকরণের
 * শ্রেণি তালিকা থেকে বাদ পড়লেও সেটা অবৈধ হয় না।
 */
export const INVENTORY_CATEGORIES = [
  "Proteins",
  "Dairy & Cheese",
  "Produce",
  "Bakery",
  "Beverage",
  "Dry Goods",
  "Spices",
  "Packaging",
  "Other",
] as const;

/** শ্রেণিহীন উপকরণগুলোর ভাগের নাম — পাতার সবার শেষে বসে। */
export const UNCATEGORISED = "Uncategorised";

/* ── একক ও পরিমাণ ─────────────────────────────────────────────────── */

/**
 * InventoryUnit enum → পর্দায় যা দেখা যায় ("12 Kg")।
 *
 * ছোট হাতের সংক্ষিপ্ত রূপ, enum-এর নাম নয় — "12 KILOGRAM" কেউ লেখে না।
 *
 * ⚠️ এটা আগে lib/supplier-status.ts-এ ছিল, কারণ প্রথম ব্যবহারকারী ছিল
 * Suppliers পাতার "Recent Deliveries"। এখন Inventory পাতাও ব্যবহার
 * করে, আর একক-এর সংজ্ঞা সরবরাহকারীর চেয়ে উপকরণের কাছাকাছি — তাই
 * এখানে।
 */
export const UNIT_LABELS: Record<string, string> = {
  GRAM: "g",
  KILOGRAM: "Kg",
  MILLILITER: "ml",
  LITER: "L",
  PIECE: "pcs",
};

export const UNIT_OPTIONS = [
  { value: "GRAM", label: "g" },
  { value: "KILOGRAM", label: "Kg" },
  { value: "MILLILITER", label: "ml" },
  { value: "LITER", label: "L" },
  { value: "PIECE", label: "pcs" },
] as const;

/** "12 Kg" / "3 pcs" — সংখ্যার শেষের অপ্রয়োজনীয় শূন্য বাদ দিয়ে। */
export function formatQuantity(quantity: number, unit: string): string {
  // `currentStock` একটা Float, তাই ১২ আসে "12" হিসেবে কিন্তু ১২.৫
  // আসে "12.5" — `parseFloat(toFixed(2))` দুটোকেই ঠিক রাখে, আর
  // "12.00 Kg" এড়ায়।
  const rounded = parseFloat(quantity.toFixed(2));
  return `${rounded} ${UNIT_LABELS[unit] ?? unit}`;
}

/**
 * bar-টা কত শতাংশ ভরাট।
 *
 * ⚠️ `maxCapacity` 0 হলে `null` — শূন্য দিয়ে ভাগ নয়, আর কলার
 * তখন bar-টা আঁকেই না। একটা মনগড়া সীমা বসিয়ে (যেমন "reorder×3")
 * bar দেখানো যেত, কিন্তু তখন সেটা একটা বানানো সংখ্যা দেখাত।
 */
export function stockPercent(currentStock: number, maxCapacity: number): number | null {
  if (maxCapacity <= 0) return null;
  // ১০০-তে আটকানো — physical count কখনো কখনো ধারণক্ষমতা ছাড়িয়ে যায়
  // (একবারে বেশি এসে গেছে), আর তখন bar বাক্সের বাইরে বেরিয়ে যেত।
  return Math.max(0, Math.min(100, (currentStock / maxCapacity) * 100));
}
