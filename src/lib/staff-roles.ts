import { STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import type { FilterMenuOption } from "@/components/admin/FilterMenu";

/**
 * src/lib/staff-roles.ts
 *
 * admin/staff/page.tsx (server component, `prisma` import করে) আর
 * admin/staff/RoleFilter.tsx (client component) — দুটোরই role-লেবেল
 * আর filter-option তালিকা লাগে। সরাসরি page.tsx থেকে RoleFilter.tsx-এ
 * import করলে পুরো page module-টাই (prisma-সহ) client bundle-এ টেনে
 * আনত। তাই এই আলাদা, নির্ভরতা-মুক্ত ফাইল — শুধু ধ্রুবক, কোনো
 * server-only import নেই।
 *
 * `FilterMenuOption` টাইপ-only import — কম্পাইল হওয়ার পর মুছে যায়,
 * তাই FilterMenu.tsx-এর "use client" এখানে কোনো প্রভাব ফেলে না।
 */

/**
 * Overview কার্ডের group label-এর সাথে মেলানো (StaffOverviewCards.tsx
 * দ্রষ্টব্য) — "Chefs"/"Rider" ওখানে যা, এখানেও তাই, যাতে এক পাতায়
 * "Chefs" কার্ড দেখে ছাঁকনিতে "Chef" খোঁজার সময় ব্যবহারকারীকে মেলাতে
 * না হয়। ব্যতিক্রম: এখানে CASHIER আর OWNER-ও আছে — তারা Overview-এ
 * নেই (CASHIER ইচ্ছাকৃতভাবে বাদ, OWNER "Managers" কার্ডে মিশে আছে),
 * কিন্তু staff list-এ প্রত্যেকেই থাকেন, তাই ছাঁকনিতেও থাকতে হবে।
 */
export const ROLE_LABELS: Record<StaffRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  WAITER: "Waiter",
  CASHIER: "Cashier",
  DELIVERY: "Rider",
  KITCHEN: "Chef",
  CLEANER: "Cleaner",
};

export const ALL_ROLES = "all";
export type RoleFilterValue = StaffRole | typeof ALL_ROLES;

export const ROLE_FILTER_OPTIONS: readonly FilterMenuOption<RoleFilterValue>[] = [
  { value: ALL_ROLES, label: "All Roles", triggerLabel: "All" },
  ...STAFF_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

export function isStaffRoleFilter(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * যে role-এর কর্মী নতুন যোগ হলে ইমেইলে "নিজের password ঠিক করুন" লিঙ্ক যায়।
 *
 * এই তিন role-এর মানুষ সত্যিই admin/rider panel-এ লগইন করে কাজ করেন —
 * password ঠিক করার লিঙ্ক ছাড়া তাঁরা ঢুকতেই পারতেন না। বাকি role
 * (Chef, Waiter, Cashier, Cleaner) এখানে নেই: তাঁদের পদ staff তালিকায়
 * রেকর্ড রাখার জন্য, তাঁদের ইমেইলে কিছু পাঠানো হয় না।
 *
 * ⚠️ ইমেইল না গেলেও তাঁদের account ঠিকই তৈরি হয় (random password সহ, যা
 * কেউ জানে না), তাই আগে-পরে কখনো লগইন দরকার হলে "Forgot password"
 * থেকে নিজে password বানিয়ে নিতে পারবেন।
 */
export const PANEL_INVITE_ROLES: readonly StaffRole[] = ["OWNER", "MANAGER", "DELIVERY"];

export function shouldSendPanelInvite(role: string): boolean {
  return (PANEL_INVITE_ROLES as readonly string[]).includes(role);
}