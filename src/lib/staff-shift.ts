/**
 * src/lib/staff-shift.ts
 *
 * schema.prisma-র `Shift` enum (MORNING/AFTERNOON/EVENING/NIGHT) স্রেফ
 * নাম রাখে — Figma-র "Evening (02:00 PM – 10:00 PM)" গড়নের পুরো লেবেলটা
 * এখানে, ঠিক customer-category.ts-এর CATEGORY_LABELS-এর মতো।
 *
 * সময়সীমা এখানে হাতে লেখা, DB থেকে নয় — একবারই ঠিক হয়েছে, বদলানোর
 * দরকার হলে এই একটা জায়গাতেই বদলাবে।
 *
 * ⚠️ customer-category.ts আর loyalty-tiers.ts-এর মতোই এই ফাইলেও Prisma
 * পৌঁছয় এমন কোনো import রাখা যাবে না — StaffForm.tsx client component
 * থেকে সরাসরি SHIFT_OPTIONS/SHIFT_LABELS ব্যবহার করে।
 */

export const SHIFTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;

export type StaffShift = (typeof SHIFTS)[number];

/** Figma-র গড়ন: "<নাম> (<শুরু> – <শেষ>)"। */
export const SHIFT_LABELS: Record<StaffShift, string> = {
  MORNING: "Morning (06:00 AM – 02:00 PM)",
  AFTERNOON: "Afternoon (10:00 AM – 06:00 PM)",
  EVENING: "Evening (02:00 PM – 10:00 PM)",
  NIGHT: "Night (10:00 PM – 06:00 AM)",
};

/**
 * Staff Information টেবিলের সারিতে যেটা দেখা যায় — Figma-র গড়ন:
 * "Evening (02-10 PM)"।
 *
 * ⚠️ SHIFT_LABELS-এর চেয়ে এটা ছোট, আর কারণটা মাপের: designer ওই
 * কলামটার জন্য ১৪২px বরাদ্দ করেছেন (Frame 2147236295), আর ১৬px
 * Frank Ruhl-এ "Evening (02-10 PM)" ঠিক ততটাই। পুরো লেবেলটা
 * ("Evening (02:00 PM – 10:00 PM)") ওখানে ~২৪০px — অর্থাৎ হয় কলামটা
 * বাকি সবাইকে চেপে দিত, নয়তো `truncate` চুপচাপ কেটে "Evening (02:00
 * PM – 1…" দেখাত। দুটোই নকশার সারিটাকে ভেঙে দিত।
 *
 * শুরুর AM/PM বাদ যায় কেবল যখন দুটো প্রান্ত একই অর্ধে পড়ে — তখনই
 * "02-10 PM" দ্ব্যর্থহীন। সকাল/বিকেল/রাতের শিফট অর্ধ পেরোয়, তাই
 * সেখানে দুটোই লেখা থাকে; নাহলে "Morning (06-02)" পড়ে কেউ বুঝতেন না
 * ওটা ৬টা থেকে ২টা না ২টা থেকে ৬টা।
 *
 * পুরো লেবেলটা এখনো আছে এবং ব্যবহার হয় যেখানে জায়গা আছে — StaffForm-এর
 * dropdown, staff/[id]/view পাতা, CSV export।
 */
export const SHIFT_TABLE_LABELS: Record<StaffShift, string> = {
  MORNING: "Morning (06 AM-02 PM)",
  AFTERNOON: "Afternoon (10 AM-06 PM)",
  EVENING: "Evening (02-10 PM)",
  NIGHT: "Night (10 PM-06 AM)",
};

/**
 * ছাঁকনি/select-এর pill-এ যেটা দেখা যায় — শুধু নামটা, সময়সীমা ছাড়া।
 * CATEGORY_SHORT_LABELS-এর একই যুক্তি: পুরো লেবেলটা একটা ছোট pill-এ
 * আঁটে না, আর তালিকার dropdown-এ তো পুরোটাই দেখানো হবে।
 */
export const SHIFT_SHORT_LABELS: Record<StaffShift, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  NIGHT: "Night",
};

export function isStaffShift(value: unknown): value is StaffShift {
  return typeof value === "string" && (SHIFTS as readonly string[]).includes(value);
}
