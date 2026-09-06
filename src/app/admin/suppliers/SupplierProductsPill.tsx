"use client";

import ListPill from "@/components/admin/ListPill";

/**
 * src/app/admin/suppliers/SupplierProductsPill.tsx
 *
 * ⚠️ এই ফাইলের পুরো ভেতরটা এখন `components/admin/ListPill.tsx`-এ।
 * Menu তালিকার "Nutrition & Time" আর "Ingredients" ঘরেও ঠিক এই
 * pill-টাই দরকার হওয়ায় ওটা সেখানে তোলা হয়েছে — কপি না করে, কারণ এই
 * প্রজেক্টেই একবার কপি করা dropdown নীরবে পিছিয়ে পড়েছিল।
 *
 * ফাইলটা রয়ে গেছে একটা মোড়ক হিসেবে, যাতে `page.tsx` আর
 * `ViewSupplierModal.tsx`-এর import দুটো ছুঁতে না হয় — নাম বদলানোর
 * ঝুঁকি নেওয়ার মতো কোনো লাভ ওখানে নেই।
 *
 * ── কেন এটা এখানে, RowActions-এর ভেতরে নয় ───────────────────────────
 *
 * ⚠️ এটা আগে `SupplierRowActions.tsx`-এর ভেতরে ছিল, আর সেখানেই থাকতে
 * পারত — যতক্ষণ না ViewSupplierModal-এরও এটা দরকার হলো। কিন্তু
 * SupplierRowActions নিজেই ViewSupplierModal-কে import করে (সারির
 * "View" বোতাম ওটাই খোলে), তাই উল্টো দিকে import করলে একটা চক্র
 * তৈরি হতো: RowActions → ViewModal → RowActions। ESM চক্র সবসময়
 * ভাঙে না, কিন্তু ভাঙলে ভাঙে নিঃশব্দে — একটা import `undefined` হয়ে
 * আসে আর "Element type is invalid" নামের রহস্যময় error দেয়।
 *
 * ── নামগুলো কোথা থেকে ───────────────────────────────────────────────
 *
 * ⚠️ `Supplier.products` থেকে — অর্থাৎ modal-এ হাতে লেখা "কী কী দিতে
 * পারেন"। আগে এগুলো purchase order-এর line item থেকে বের করা হতো
 * ("কী কী এসেছে"), কিন্তু Figma-র modal-এ ঘরটা যোগ হওয়ায় এখন উৎস
 * একটাই। দুটোর তফাত আছে: নতুন সরবরাহকারীর কোনো অর্ডার নেই, অথচ তিনি
 * কী দেন সেটা জানা থাকে।
 *
 * Figma-তে pill-এ একটাই নাম দেখানো, কিন্তু সেটা designer-এর নমুনা।
 * বাস্তবে একাধিক থাকলে "Chicken +3" দেখানো হয়, নাহলে ব্যবহারকারী
 * ভাবতেন ওই একটাই পণ্য আসে।
 */
export function SupplierProductsPill({
  products,
  surface = "white",
}: {
  products: string[];
  surface?: "white" | "cream";
}) {
  return <ListPill items={products} surface={surface} ariaLabel="Products supplied" />;
}
