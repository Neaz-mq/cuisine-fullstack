import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/order-status-filter.ts
 *
 * /admin/orders-এর toolbar-এর ছাঁকনি — Figma-র "All Statuses ⌄"।
 *
 * ⚠️ আলাদা ফাইল, কারণ `OrdersToolbar.tsx`-এর মাথায় `"use client"` — ওই
 * ফাইল থেকে component ছাড়া কিছু server-এ যায় না, আর `page.tsx`
 * (server component) এই যাচাই-function-টা ব্যবহার করে।
 * `lib/menu-status-filter.ts` আর `lib/category-filter.ts` একই কারণে
 * একইভাবে সাজানো।
 *
 * ⚠️ মানগুলো `OrderStatus` enum-এর হুবহু নাম, কারণ সেগুলোই সরাসরি
 * Prisma-র `where`-এ যায়। "ALL" enum-এ নেই — ওটা "ছাঁকো না" বোঝায়,
 * আর `page.tsx` সেটাকে where থেকে বাদ দেয়।
 */
export type OrderStatusFilter =
  | "ALL"
  | "PLACED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export const DEFAULT_ORDER_STATUS: OrderStatusFilter = "ALL";

const VALUES: OrderStatusFilter[] = [
  "ALL",
  "PLACED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export function isOrderStatus(value: unknown): value is OrderStatusFilter {
  return typeof value === "string" && (VALUES as string[]).includes(value);
}

export const ORDER_STATUS_OPTIONS: FilterMenuOption<OrderStatusFilter>[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PLACED", label: "Order Placed", triggerLabel: "Placed" },
  { value: "PREPARING", label: "Preparing" },
  // triggerLabel ছোট — pill-এ "Out for Delivery" লম্বা হয়ে search ঘরের
  // ঘাড়ে চেপে বসত; popup-এ পুরো নামটাই থাকে।
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery", triggerLabel: "On the Way" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * তালিকার ব্যাজের রঙ আর লেখা।
 *
 * ⚠️ Figma-র ব্যাজগুলো: Order Place (কমলা), Preparing (হলুদ), On the Way
 * (গোলাপি/বেগুনি), Delivered (সবুজ)। বাতিলের কোনো রঙ নকশায় নেই, তাই
 * ঘরের নিজের বিপদ-লাল (#D72A37) আর তার হালকা পটভূমি — Menu আর
 * Categories-এর "Unavailable" চিহ্নে হুবহু এই দুটোই।
 */
export const ORDER_STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  PLACED: { label: "Order Place", className: "bg-[#FFF1E5] text-[#FF7100]" },
  PREPARING: { label: "Preparing", className: "bg-[#FFF8E1] text-[#B98900]" },
  OUT_FOR_DELIVERY: { label: "On the Way", className: "bg-[#FDE7F3] text-[#C2258A]" },
  DELIVERED: { label: "Delivered", className: "bg-[#E8FFEC] text-[#0E9F00]" },
  CANCELLED: { label: "Cancelled", className: "bg-[#FAE7EC] text-[#D72A37]" },
};

/**
 * ⚠️ dine-in অর্ডার কখনো "delivery-তে বেরোয়নি", তাই DB-র enum একই
 * রেখেই লেখাটা বদলে যায়। enum-এ আলাদা একটা DINE_IN অবস্থা যোগ না করার
 * সিদ্ধান্তটা পুরনো, আর `OrderStatusSelect.tsx`-এও একই কথা লেখা আছে।
 */
export function orderStatusLabel(
  status: string,
  orderType?: "DELIVERY" | "DINE_IN"
): string {
  if (status === "OUT_FOR_DELIVERY" && orderType === "DINE_IN") return "Ready to Serve";
  return ORDER_STATUS_BADGE[status]?.label ?? status.replace(/_/g, " ");
}
