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
