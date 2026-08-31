/**
 * src/lib/format-date.ts
 *
 * আগে admin/users/page.tsx-এ inline ছিল। Staff page-এও "Join Date"
 * কলামে হুবহু একই গড়ন লাগে ("Jul 3, 2026"), তাই StaffOverviewCards/
 * UserAvatar-এর একই কারণে এখানে বের করা।
 */
export function formatJoinDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}