import { prisma } from "@/lib/prisma";
import { formatOrderId } from "@/lib/format-order-id";

/**
 * src/lib/admin-notifications.ts
 *
 * /admin/notifications পাতার feed।
 *
 * ── কেন কোনো Notification টেবিল নেই ────────────────────────────────
 *
 * ⚠️ একটা `Notification` model বানানো যেত, কিন্তু তাহলে প্রতিটা ঘটনার
 * জায়গায় (অর্ডার তৈরি, বুকিং, রিভিউ, স্টক কমা, ডেলিভারি শেষ…) একটা
 * করে "সারি লেখো" কোড বসাতে হতো। সেটা দুটো সমস্যা তৈরি করত:
 *
 *   ১. কোনো এক পথে সারি লিখতে ভুলে গেলে notification নীরবে হারাত, আর
 *      সেটা ধরা পড়ত কেবল কেউ অভিযোগ করলে।
 *   ২. একই তথ্য দুই জায়গায় থাকত — Order টেবিলে আর Notification টেবিলে।
 *      অর্ডার বাতিল হলে notification-টা বাসি হয়ে যেত।
 *
 * তাই feed-টা চলতে চলতে তৈরি হয়, আসল সারিগুলো থেকেই। এতে তথ্য কখনো
 * বাসি হয় না, আর নতুন কোনো ঘটনার ধরন যোগ করতে হলে কেবল এই ফাইলে
 * একটা query যোগ করলেই হয় — বাকি কোডে হাত দিতে হয় না।
 *
 * ⚠️ এর দাম: feed-টা সীমিত সংখ্যক সাম্প্রতিক সারি থেকে বানানো হয়
 * (প্রতিটা উৎস থেকে `SOURCE_LIMIT`), অর্থাৎ "সব সময়ের সব notification"
 * নয়। বাস্তবে কেউ ছ-মাস আগের notification খোঁজেন না — তার জন্য
 * Orders বা Reservations পাতা আছে, যেখানে ছাঁকনি আর খোঁজা দুটোই আছে।
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

/**
 * প্রতিটা উৎস থেকে কতগুলো সাম্প্রতিক সারি আনা হবে।
 *
 * ⚠️ পাঁচটা উৎস × ৪০ = সর্বোচ্চ ২০০টা সারি স্মৃতিতে, তারপর সময় ধরে
 * সাজিয়ে পাতা করা হয়। DB-তে একসাথে sort করা যেত না, কারণ সারিগুলো
 * পাঁচটা আলাদা টেবিলের।
 */
const SOURCE_LIMIT = 40;

export type NotificationFilter = "ALL" | "UNREAD" | "READ" | "ALERTS";

export async function getAdminNotifications(readAt: Date | null): Promise<AdminNotification[]> {
  const [orders, deliveries, reservations, reviews, lowStock] = await Promise.all([
    prisma.order.findMany({
      where: { status: "PLACED" },
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        createdAt: true,
        firstName: true,
        grandTotal: true,
        currency: true,
        currencyMinorUnits: true,
      },
    }),
    prisma.order.findMany({
      where: { status: "DELIVERED", deliveredAt: { not: null } },
      orderBy: { deliveredAt: "desc" },
      take: SOURCE_LIMIT,
      select: { id: true, deliveredAt: true, firstName: true },
    }),
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        createdAt: true,
        customerName: true,
        guestCount: true,
        reservedAt: true,
        status: true,
        table: { select: { label: true } },
      },
    }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        createdAt: true,
        rating: true,
        status: true,
        user: { select: { name: true } },
        menuItem: { select: { title: true } },
      },
    }),
    /**
     * ⚠️ কম-স্টকের সতর্কতায় `updatedAt` সময় হিসেবে ধরা হয় — অর্থাৎ
     * "স্টকটা শেষ কবে নড়েছে"। নিখুঁত নয় (দাম বদলালেও `updatedAt` বদলায়),
     * কিন্তু আলাদা করে "কবে threshold পেরোল" সংরক্ষিত হয় না, আর সেটার
     * জন্য একটা নতুন কলাম যোগ করা এই feed-এর জন্য বাড়াবাড়ি হতো।
     */
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      take: SOURCE_LIMIT,
      select: {
        id: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderThreshold: true,
        updatedAt: true,
      },
    }),
  ]);

  // ⚠️ `readAt` null মানে staff কখনো "সব পড়া হয়েছে" চাপেননি — তখন
  // সবই অপঠিত, আর সেটাই ঠিক আচরণ।
  const isRead = (at: Date) => readAt !== null && at.getTime() <= readAt.getTime();

  const feed: AdminNotification[] = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "ORDER" as const,
      title: "New order placed",
      description: `${order.firstName} placed order ${formatOrderId(order.id)} for ${order.currency} ${order.grandTotal.toFixed(order.currencyMinorUnits)}`,
      createdAt: order.createdAt.toISOString(),
      read: isRead(order.createdAt),
      href: "/admin/orders",
    })),

    ...deliveries.flatMap((order) =>
      order.deliveredAt
        ? [
            {
              id: `delivered-${order.id}`,
              kind: "DELIVERY" as const,
              title: "Order delivered",
              description: `Order ${formatOrderId(order.id)} was delivered to ${order.firstName}`,
              createdAt: order.deliveredAt.toISOString(),
              read: isRead(order.deliveredAt),
              href: "/admin/orders",
            },
          ]
        : []
    ),

    ...reservations.map((reservation) => ({
      id: `reservation-${reservation.id}`,
      kind: "RESERVATION" as const,
      title:
        reservation.status === "CANCELLED" ? "Reservation cancelled" : "New table reservation",
      description: `${reservation.customerName} booked Table ${reservation.table.label} for ${reservation.guestCount} ${
        reservation.guestCount === 1 ? "guest" : "guests"
      } on ${reservation.reservedAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      createdAt: reservation.createdAt.toISOString(),
      read: isRead(reservation.createdAt),
      href: "/admin/reservations",
    })),

    ...reviews.map((review) => ({
      id: `review-${review.id}`,
      kind: "REVIEW" as const,
      title: review.status === "APPROVED" ? "Review approved" : "New review submitted",
      description: `${review.user.name ?? "A customer"} rated ${review.menuItem.title} ${review.rating}★${
        review.status === "PENDING" ? " — awaiting approval" : ""
      }`,
      createdAt: review.createdAt.toISOString(),
      read: isRead(review.createdAt),
      href: "/admin/reviews",
    })),

    // ⚠️ কেবল সেই পদগুলো যেগুলো সত্যিই threshold-এর নিচে — তালিকাটা
    // উপরে ৪০টা টানা হয়, ছাঁকা হয় এখানে।
    ...lowStock
      .filter((item) => item.currentStock <= item.reorderThreshold)
      .map((item) => ({
        id: `stock-${item.id}`,
        kind: "STOCK" as const,
        title: "Low stock alert",
        description: `${item.name} is running low — ${item.currentStock} ${item.unit.toLowerCase()} left`,
        createdAt: item.updatedAt.toISOString(),
        read: isRead(item.updatedAt),
        href: "/admin/inventory",
      })),
  ];

  // নতুনগুলো আগে।
  return feed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

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
