/**
 * src/lib/notification-filters.ts
 *
 * Notification feed-এর **type আর ছাঁকার নিয়ম** — কোনো database ছোঁয় না।
 *
 * ⚠️ এটা `admin-notifications.ts` থেকে আলাদা করা হয়েছে, আর কারণটা
 * গুরুত্বপূর্ণ: toolbar একটা client component, আর সেটা এখান থেকে
 * `NOTIFICATION_FILTERS` আনে। আগে সব কিছু এক ফাইলে ছিল, তাই ওই import
 * ধরে Prisma → pg → Node-এর `dns` module পর্যন্ত পুরো শেকলটা browser
 * bundle-এ ঢুকতে চাইত, আর Turbopack "Module not found: Can't resolve
 * 'dns'" দিয়ে থেমে যেত।
 *
 * নিয়ম: client component যে ফাইল থেকে **runtime মান** আনে, সেই ফাইলে
 * `prisma` import থাকতে পারে না। শুধু `import type` হলে সমস্যা নেই,
 * কারণ type compile-এর সময়ই মুছে যায়।
 */


export type NotificationKind = "ORDER" | "RESERVATION" | "REVIEW" | "STOCK" | "DELIVERY";

export type AdminNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  /** ISO — client-এ "2 min ago" হিসেবে দেখানো হয়। */
  createdAt: string;
  read: boolean;
  /** ক্লিক করলে কোথায় যাবে। */
  href: string;
};

/** পাতার status ছাঁকনির সম্ভাব্য মানগুলো। */
export type NotificationFilter = "ALL" | "UNREAD" | "READ" | "ALERTS";

/**
 * তারিখ ধরে ভাগ — Figma-র "Today" / "Yesterday" শিরোনাম।
 *
 * ⚠️ ভাগটা server-এ নয়, client-এ করা হয় (NotificationFeed.tsx), কারণ
 * "আজ" মানে দর্শকের ঘড়ির আজ। server Vercel-এ UTC-তে চলে, তাই
 * বাংলাদেশে সন্ধ্যার পরের সব কিছু "কাল" দেখাত।
 */
export function notificationCounts(feed: AdminNotification[]) {
  const unread = feed.filter((item) => !item.read).length;

  return {
    total: feed.length,
    read: feed.length - unread,
    unread,
    // "System Alerts" — কম-স্টকের মতো যেগুলো কোনো গ্রাহকের কাজ নয়,
    // সিস্টেম নিজে থেকে তুলেছে।
    alerts: feed.filter((item) => item.kind === "STOCK").length,
  };
}

/**
 * পাতার ছাঁকনিগুলো — খোঁজা, অবস্থা আর সময়সীমা।
 *
 * ⚠️ ছাঁকাটা DB-তে নয়, স্মৃতিতে। feed-টা পাঁচটা আলাদা টেবিল থেকে জোড়া
 * লাগে, তাই একটামাত্র SQL `WHERE` দিয়ে সবটা ছাঁকা যেত না। তালিকাটা
 * কয়েকশো সারির বেশি হয় না (SOURCE_LIMIT দ্রষ্টব্য), তাই স্মৃতিতে ছাঁকা
 * এখানে নিরাপদ — লাখ সারির টেবিলে এটা করা যেত না।
 */
export function filterNotifications(
  feed: AdminNotification[],
  { q, status, since }: { q?: string; status: NotificationFilter; since: Date | null }
): AdminNotification[] {
  const needle = q?.trim().toLowerCase();

  return feed.filter((item) => {
    if (since && new Date(item.createdAt) < since) return false;

    if (status === "UNREAD" && item.read) return false;
    if (status === "READ" && !item.read) return false;
    if (status === "ALERTS" && item.kind !== "STOCK") return false;

    if (needle) {
      // শিরোনাম আর বিবরণ দুটোতেই খোঁজা হয় — গ্রাহকের নাম, অর্ডার নম্বর
      // আর পদের নাম সবই বিবরণের ভেতরে থাকে।
      const haystack = `${item.title} ${item.description}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "UNREAD", label: "Unread" },
  { value: "READ", label: "Read" },
  { value: "ALERTS", label: "System Alerts" },
];

export function isNotificationFilter(value: unknown): value is NotificationFilter {
  return (
    typeof value === "string" && ["ALL", "UNREAD", "READ", "ALERTS"].includes(value)
  );
}
