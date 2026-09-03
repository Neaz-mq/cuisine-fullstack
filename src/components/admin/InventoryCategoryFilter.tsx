"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilterMenu, { type FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/components/admin/InventoryCategoryFilter.tsx
 *
 * "Kitchen Inventory" কার্ডের উপরের ছাঁকনি — All Categories · Proteins ·
 * Dairy & Cheese · …
 *
 * OverviewPeriodFilter-এর হুবহু একই গড়ন: Overview কার্ডগুলো server
 * component, তাই FilterMenu সরাসরি ব্যবহার করা যায় না (onSelect-এ
 * router লাগে, আর router client-only hook)। কাজটা শুধু URL-এর একটা
 * param বদলানো।
 *
 * ── কেন period নয়, category ─────────────────────────────────────────
 *
 * ⚠️ Figma-তে এখানে "Today ⌄" আঁকা, কিন্তু ওটা বসানো যেত না — কারণ
 * নিচের চারটে সংখ্যাই **বর্তমান অবস্থা**, সময়ের হিসাব নয়। "এখন কত
 * জিনিস কম আছে" প্রশ্নের কোনো "গত সপ্তাহে" রূপ হয় না; সেটা দিতে হলে
 * প্রতিদিনের stock-এর স্থিরচিত্র রাখতে হতো, যা schema-য় নেই
 * (StockMovement নড়াচড়ার তালিকা, স্থিরচিত্র নয়)। period ছাঁকনি বসালে
 * হয় কিছুই বদলাত না, নয়তো ভুল সংখ্যা দেখাত — দুটোই খারাপ।
 *
 * শ্রেণি দিয়ে ছাঁকাটা ওই একই জায়গায় সত্যিকারের কাজে লাগে, আর
 * inventory ব্যবস্থায় এটাই সবচেয়ে প্রচলিত ছাঁকনি: "প্রোটিনের অবস্থা
 * কেমন" — মোট কতটা, কতটা কম, কতটা ফুরিয়েছে। সংখ্যাগুলোর অর্থ এতে
 * বদলায় না, শুধু পরিধি ছোট হয়।
 */
export default function InventoryCategoryFilter({
  value,
  options,
  param = "cat",
}: {
  value: string;
  /**
   * শুধু সেই শ্রেণিগুলো যেগুলোতে সত্যিই জিনিস আছে — server component
   * তালিকা থেকে বানিয়ে পাঠায়।
   *
   * ⚠️ পুরো INVENTORY_CATEGORIES দেখানো হয় না, ইচ্ছাকৃতভাবে। খালি
   * শ্রেণি বাছলে চারটে শূন্য দেখাত আর ব্যবহারকারী ভাবতেন কিছু ভেঙেছে।
   * যেটা বাছা যায়, সেটা বাছলে কিছু একটা দেখাবে — এটুকু নিশ্চিত থাকা
   * ছাঁকনির ন্যূনতম শর্ত।
   */
  options: readonly FilterMenuOption<string>[];
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());

    // ডিফল্ট মানটা URL-এ লেখা হয় না — `?cat=all` দেখতে এমন লাগে যেন
    // কিছু ছাঁকা হয়েছে, অথচ হয়নি। বাকি ছাঁকনিগুলোও একই নিয়মে চলে।
    if (next === "all") params.delete(param);
    else params.set(param, next);

    /**
     * ⚠️ বাকি সব param অক্ষত — শ্রেণি-ভাগগুলোর `p_proteins` ইত্যাদি
     * page নম্বরও। এই ছাঁকনি নিচের তালিকাটা বদলায় না, শুধু উপরের
     * চারটে সংখ্যা; তাই কেউ কোনো ভাগের ২ নম্বর page-এ থাকা অবস্থায়
     * এটা বদলালে তাঁকে ১ নম্বরে ছুঁড়ে ফেলা অকারণ ক্ষতি হতো।
     * OverviewPeriodFilter-এ ঠিক এই যুক্তিটাই লেখা আছে।
     */
    router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  return (
    <FilterMenu
      value={value}
      options={options}
      onSelect={handleSelect}
      ariaLabel="Filter inventory summary by category"
    />
  );
}
