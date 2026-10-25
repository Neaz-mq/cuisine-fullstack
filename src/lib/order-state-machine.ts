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
 * পুরো পথটা (DELIVERY অর্ডার):
 *
 *   PLACED ──(admin: Move to Kitchen)──▶ PREPARING
 *   PREPARING ──(kitchen: Ready)──▶ READY
 *   READY ──(admin: rider assign / rider: Picked Up)──▶ OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY ──(rider: Mark Delivered)──▶ DELIVERED
 *
 * DINE_IN অর্ডারে delivery leg নেই: READY ──(admin: Mark Served)──▶ DELIVERED।
 * READY থেকে সরাসরি DELIVERED তাই এখানে বৈধ; DELIVERY অর্ডারকে READY থেকে
 * DELIVERED-এ লাফ দেওয়া আটকানো হয় mark-order-delivered.ts-এ, কারণ ওই
 * নিয়মটা অর্ডারের ধরনের উপর নির্ভর করে — যেটা এই map জানে না।
 *
 * ⚠️ PREPARING থেকে এখন READY ছাড়া কোথাও যাওয়া যায় না (cancel বাদে)। আগে
 * PREPARING থেকে সরাসরি OUT_FOR_DELIVERY/DELIVERED যাওয়া যেত, ফলে রান্নাঘর
 * "Ready" না করেই অর্ডার বেরিয়ে যেত।
 *
 * DELIVERED আর CANCELLED terminal — সেখান থেকে ফেরার পথ নেই। ভুল হলে
 * নতুন order তৈরি করতে হবে, status উল্টে দেওয়া যাবে না; কারণ loyalty
 * point, stock deduction আর gift card debit ইতিমধ্যে ঘটে গেছে, আর
 * সেগুলো status উল্টালেই আপনাআপনি ফেরত আসে না।
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

/** পড়ার মতো করে status লেখা — "OUT_FOR_DELIVERY" নয়, "out for delivery". */
function humanize(status: OrderStatus): string {
  return status.toLowerCase().replace(/_/g, " ");
}

/**
 * এই status থেকে পরের কোন কোন status-এ যাওয়া যায় — admin dropdown শুধু
 * এগুলোই দেখায়, যাতে অচল বিকল্প বেছে নীরবে ব্যর্থ হওয়ার সুযোগই না থাকে।
 */
export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
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
 * কোন অবস্থায় DELIVERY অর্ডারে rider বসানো যায় (বা বদলানো যায়)।
 *
 * READY — রান্নাঘর "Ready" করার পরেই rider বসানো যায়, তার আগে নয়। আর
 * OUT_FOR_DELIVERY — rider ইতিমধ্যে আছে, অন্য rider বসানো (reassign)।
 *
 * PLACED/PREPARING থেকে সরাসরি rider বসানো আটকানো হয়, নাহলে রান্না শেষ
 * হওয়ার আগেই অর্ডার "পথে" দেখাত।
 */
export function canAssignRider(current: OrderStatus): boolean {
  return current === "READY" || current === "OUT_FOR_DELIVERY";
}