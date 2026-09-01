import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/supplier-status.ts
 *
 * /admin/suppliers-এর দুই রকম "status" — আর দুটো এক নয়, তাই এক ফাইলে
 * পাশাপাশি রাখা হলো যাতে কেউ গুলিয়ে না ফেলেন।
 *
 *   সরবরাহকারীর status  — Supplier.isActive, অর্থাৎ "এঁদের থেকে এখনো
 *                          মাল আনা হয় কি না"
 *   ডেলিভারির status    — PurchaseOrder.status, অর্থাৎ একটা নির্দিষ্ট
 *                          চালান কোন পর্যায়ে
 */

/* ── সরবরাহকারীর ছাঁকনি ───────────────────────────────────────────── */

export const SUPPLIER_STATUSES = ["all", "active", "inactive"] as const;

export type SupplierStatusFilter = (typeof SUPPLIER_STATUSES)[number];

export const DEFAULT_SUPPLIER_STATUS: SupplierStatusFilter = "all";

export function isSupplierStatusFilter(value: unknown): value is SupplierStatusFilter {
  return typeof value === "string" && (SUPPLIER_STATUSES as readonly string[]).includes(value);
}

export const SUPPLIER_STATUS_OPTIONS: FilterMenuOption<SupplierStatusFilter>[] = [
  // Figma-র pill-এ লেখা "All Statuses", কিন্তু popup-এ শুধু "All" —
  // FilterMenu-র triggerLabel/label জোড়াটা ঠিক এই কাজের জন্যই।
  { value: "all", label: "All", triggerLabel: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/* ── সরবরাহের শ্রেণি ──────────────────────────────────────────────── */

/**
 * Figma-র "Supply Category" dropdown-এর তালিকা।
 *
 * ⚠️ এটা schema-র enum নয়, শুধু UI-র তালিকা — `Supplier.category`
 * একটা free-text column (কারণ schema.prisma-র মন্তব্যে)। ফল: এখানে
 * একটা শ্রেণি যোগ বা বাদ দিতে কোনো migration লাগে না, আর পুরনো
 * সরবরাহকারীর শ্রেণি তালিকা থেকে বাদ পড়লেও তাঁর record অবৈধ হয় না —
 * শুধু dropdown-এ আর বাছা যায় না।
 *
 * Figma-তে একটাই নমুনা ("Protein"); বাকিগুলো একটা রেস্তোরাঁর
 * স্বাভাবিক ক্রয়-শ্রেণি।
 */
export const SUPPLY_CATEGORIES = [
  "Protein",
  "Dairy",
  "Produce",
  "Bakery",
  "Beverage",
  "Dry Goods",
  "Spices",
  "Packaging",
  "Other",
] as const;

/* ── ডেলিভারির status ─────────────────────────────────────────────── */

/**
 * PurchaseOrder.status → Figma-র "Resent Deliveries" pill।
 *
 * ⚠️ নামগুলো schema-র enum নয়, আর সেটা ইচ্ছাকৃত। enum-টা ক্রয়ের
 * দৃষ্টিকোণ থেকে লেখা (DRAFT = অর্ডারটা এখনো বানানো হচ্ছে, ORDERED =
 * সরবরাহকারীকে বলা হয়েছে), কিন্তু এই কার্ডটা **ডেলিভারির** দৃষ্টিকোণ
 * থেকে পড়া হয়: মালটা কি এসে গেছে, না রাস্তায়, না এখনো পাঠানোই হয়নি।
 * তাই ORDERED = "On the Way", RECEIVED = "Delivered"।
 *
 * রঙগুলো Figma-র নিজের hex — সবুজ #E8FFEC/#0ECF00 (সারির Active
 * pill-এর একই জোড়া), হলুদ #FFF2DA/#FF9E00, বেগুনি #EBE0FF/#5A00FF।
 * CANCELLED-এর জন্য Figma-তে কোনো নমুনা নেই, তাই প্রজেক্টের বিপদ-রঙ
 * (#FAE7EC/#D72A37) — সারির Inactive pill যেটা ব্যবহার করে।
 */
export const DELIVERY_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  RECEIVED: { label: "Delivered", className: "bg-[#E8FFEC] text-[#0ECF00]" },
  ORDERED: { label: "On the Way", className: "bg-[#EBE0FF] text-[#5A00FF]" },
  DRAFT: { label: "Pending", className: "bg-[#FFF2DA] text-[#FF9E00]" },
  CANCELLED: { label: "Cancelled", className: "bg-[#FAE7EC] text-[#D72A37]" },
};

/**
 * InventoryUnit enum → পর্দায় যা দেখা যায় ("12 Kg")।
 *
 * ছোট হাতের সংক্ষিপ্ত রূপ, enum-এর নাম নয় — "12 KILOGRAM" কেউ লেখে না।
 */
export const UNIT_LABELS: Record<string, string> = {
  GRAM: "g",
  KILOGRAM: "Kg",
  MILLILITER: "ml",
  LITER: "L",
  PIECE: "pcs",
};

/** "12 Kg" / "3 pcs" — সংখ্যার শেষের অপ্রয়োজনীয় শূন্য বাদ দিয়ে। */
export function formatQuantity(quantity: number, unit: string): string {
  // `quantityOrdered` একটা Float, তাই ১২ আসে "12" হিসেবে কিন্তু ১২.৫
  // আসে "12.5" — `parseFloat(toFixed(2))` দুটোকেই ঠিক রাখে, আর
  // "12.00 Kg" এড়ায়।
  const rounded = parseFloat(quantity.toFixed(2));
  return `${rounded} ${UNIT_LABELS[unit] ?? unit}`;
}
