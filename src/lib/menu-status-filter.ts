import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/menu-status-filter.ts
 *
 * /admin/menu-এর toolbar-এর ছাঁকনি — Figma-র "All Statuses ⌄"
 * (Frame 2147236296-এর ভেতরের 156×50 pill)।
 *
 * ⚠️ আলাদা ফাইল, কারণ `MenuToolbar.tsx`-এর মাথায় `"use client"` — ওই
 * ফাইল থেকে component ছাড়া কিছু server-এ যায় না, আর `page.tsx`
 * (server component) এই যাচাই-function-টা ব্যবহার করে।
 * `lib/category-filter.ts` আর `lib/kitchen-status.ts` একই কারণে
 * একইভাবে সাজানো।
 *
 * এটা **তালিকার** ছাঁকনি: বাছাই করলে নিচের পদগুলো সত্যিই কমে যায়
 * (Overview-র সংখ্যা নয় — ওটার নিজের আলাদা period ছাঁকনি আছে)।
 */
export type MenuStatusFilter = "all" | "available" | "unavailable";

export const DEFAULT_MENU_STATUS: MenuStatusFilter = "all";

export function isMenuStatus(value: unknown): value is MenuStatusFilter {
  return typeof value === "string" && ["all", "available", "unavailable"].includes(value);
}

export const MENU_STATUS_OPTIONS: FilterMenuOption<MenuStatusFilter>[] = [
  { value: "all", label: "All Statuses" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
];
