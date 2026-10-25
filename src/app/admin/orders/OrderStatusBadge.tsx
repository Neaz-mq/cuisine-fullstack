import { ORDER_STATUS_BADGE, orderStatusLabel } from "@/lib/order-status-filter";

/**
 * src/app/admin/orders/OrderStatusBadge.tsx
 *
 * Orders list-এর Status ঘর — **শুধু দেখায়, বদলায় না**।
 *
 * ⚠️ আগে এখানে একটা dropdown ছিল (OrderStatusSelect), যেখান থেকে হাতে
 * যেকোনো status বেছে নেওয়া যেত। এখন status আপনা-আপনি বদলায়, ধাপে ধাপে,
 * যার যার কাজের জায়গা থেকে:
 *
 *   Order Place → (admin "Move to Kitchen") → Preparing
 *   Preparing   → (রান্নাঘর "Ready")          → Ready
 *   Ready       → (admin rider assign)        → On the Way
 *   On the Way  → (rider "Mark Delivered")    → Delivered
 *
 * তাই এখানে কোনো ⌄ আইকন বা তালিকা নেই — শুধু বর্তমান অবস্থার ব্যাজ। (বাতিল
 * করার পথ আছে অর্ডারের নিজের পাতায় — /admin/orders/[id]।)
 *
 * Server component — কোনো state বা handler লাগে না, তাই "use client" নেই।
 */
export default function OrderStatusBadge({
  status,
  orderType,
}: {
  status: string;
  orderType?: "DELIVERY" | "DINE_IN";
}) {
  const badgeClass = ORDER_STATUS_BADGE[status]?.className ?? "bg-black/5 text-black";

  return (
    <span
      className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 font-sora text-[12px] font-medium leading-none ${badgeClass}`}
    >
      {orderStatusLabel(status, orderType)}
    </span>
  );
}
