import type { OrderStatus } from "@/generated/prisma/client";

/**
 * src/lib/order-state-machine.ts
 *
 * এক জায়গায় সব order status transition rule.
 *
 * আগে rule গুলো ছড়ানো ছিল — advance-order-to-preparing.ts শুধু CANCELLED
 * আটকাতো, mark-order-delivered.ts-ও তাই, আর assign-rider কোনো check
 * ছাড়াই সরাসরি OUT_FOR_DELIVERY লিখে দিতো। ফলে একটা PLACED order
 * PREPARING সম্পূর্ণ এড়িয়ে বেরিয়ে যেতে পারতো — আর PREPARING-এই যেহেতু
 * inventory deduct হয়, সেই order-এর ingredient কখনো হিসাবেই আসতো না।
 * ভুলটা নীরব: রান্নাঘর সত্যিই মাল খরচ করছে, StockMovement-এ কিছুই নেই,
 * currentStock ধীরে ধীরে বাস্তবতা থেকে সরে যাচ্ছে।
 *
 * এখন status বদলানোর প্রতিটা route এই file-এর মধ্য দিয়ে যায়।
 */

/**
 * কোন status থেকে কোথায় যাওয়া যাবে।
 *
 * PREPARING -> DELIVERED সরাসরি অনুমোদিত, কারণ DINE_IN order-এর কোনো
 * delivery leg নেই — waiter টেবিলে খাবার দিয়ে সরাসরি DELIVERED করে।
 *
 * DELIVERED আর CANCELLED terminal — সেখান থেকে ফেরার পথ নেই। ভুল হলে
 * নতুন order তৈরি করতে হবে, status উল্টে দেওয়া যাবে না; কারণ loyalty
 * point, stock deduction আর gift card debit ইতিমধ্যে ঘটে গেছে, আর
 * সেগুলো status উল্টালেই আপনাআপনি ফেরত আসে না।
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** পড়ার মতো করে status লেখা — "OUT_FOR_DELIVERY" নয়, "out for delivery". */
function humanize(status: OrderStatus): string {
  return status.toLowerCase().replace(/_/g, " ");
}

/** যে status থেকে আর কোথাও যাওয়া যায় না। */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/**
 * এই transition বৈধ কিনা। একই status-এ থাকা (no-op) বৈধ ধরা হয়, যাতে
 * dropdown-এ একই মান আবার select করলে অকারণে error না দেখায়।
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * অবৈধ হলে user-কে দেখানোর মতো বার্তা, বৈধ হলে null. Route গুলো এভাবে
 * ব্যবহার করবে:
 *
 *   const error = transitionError(order.status, nextStatus);
 *   if (error) return NextResponse.json({ error }, { status: 409 });
 */
export function transitionError(from: OrderStatus, to: OrderStatus): string | null {
  if (canTransition(from, to)) return null;

  if (isTerminalStatus(from)) {
    return `This order is already ${humanize(from)} and can no longer be changed`;
  }
  return `Cannot move an order from ${humanize(from)} to ${humanize(to)}`;
}

/**
 * DELIVERY order-এ rider assign করার সময়: OUT_FOR_DELIVERY-তে যাওয়ার
 * আগে কি আগে PREPARING হয়ে নিতে হবে?
 *
 * PLACED থেকে সরাসরি লাফ দিলে stock deduction হারিয়ে যায়, তাই
 * assign-rider এটা দেখে আগে advanceOrderToPreparing() চালায়। অর্থাৎ
 * "rider assign করা" মানেই "রান্না শুরু হয়েছে" ধরে নেওয়া হচ্ছে — যা
 * বাস্তবেও সত্যি, কেউ রান্না না করে খাবার পাঠায় না।
 */
export function needsPreparingFirst(current: OrderStatus): boolean {
  return current === "PLACED";
}