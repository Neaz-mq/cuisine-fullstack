"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import { formatOrderId } from "@/lib/format-order-id";

const POLL_INTERVAL_MS = 15000; // NotificationBell-এর সাথে একই ছন্দ
const URGENT_AFTER_MS = 15 * 60 * 1000; // ১৫ মিনিটের পুরনো অর্ডার লাল

type OrderItem = {
  id: string;
  quantity: number;
  menuItem: { title: string };
};

type KitchenOrder = {
  id: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY";
  orderType: "DELIVERY" | "DINE_IN";
  firstName: string;
  lastName: string;
  createdAt: string;
  items: OrderItem[];
  table: { label: string } | null;
};

/**
 * NotificationBell-এর "ping" সুরের স্থানীয় কপি। রান্নাঘরের নিজস্ব
 * পর্দায় NotificationBell mount থাকে না, তাই ওই instance-এর effect-এর
 * উপর ভরসা করা যায় না।
 */
function playBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // autoplay নীতি নীরবে আটকে দিতে পারে — বোর্ড তবু আপডেট হয়
  }
}

function elapsedLabel(createdAt: string, nowMs: number) {
  const minutes = Math.floor((nowMs - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * ⚠️ ঘণ্টা/দিনের ধাপটা নতুন। আগে সবসময় মিনিট দেখাত, তাই পুরনো
 * অর্ডারে "25994m ago" লেখা উঠত — মানুষ ওটা পড়ে কিছু বোঝে না, আর
 * Figma-র ছোট pill-টাতেও আঁটে না।
 */

const GRADIENT =
  "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)]";
const FOCUS_RING =
  "focus:outline-none focus-visible:[outline:2px_solid_#FF9540] focus-visible:[outline-offset:2px]";

/**
 * Figma Frame 2147236331 — অর্ডারের জিনিসের তালিকা।
 *
 * ⚠️ একটার বেশি জিনিস হলে তালিকাটা গুটিয়ে থাকে, শুধু প্রথমটা দেখায়,
 * পাশে একটা তীর। খোলা যায়।
 *
 * কেন গুটিয়ে রাখা: এটা কোনো সাজসজ্জা নয়। আপনার এখনকার পর্দায়
 * #ORD-V3APZR-এ আটটা লাইন, আর তাতে কার্ডটা এত লম্বা যে নিচের
 * অর্ডারগুলো পর্দার বাইরে চলে যায় — রান্নাঘরের বোর্ডে ওটাই সবচেয়ে
 * বড় ক্ষতি, কারণ কোন অর্ডারটা কতক্ষণ ঝুলছে সেটাই আসল তথ্য।
 *
 * ⚠️ radius দুটো অবস্থায় দুরকম, Figma-র মাপ ধরে: গোটানো অবস্থায়
 * `100px` (একটা লম্বাটে বড়ি), খোলা অবস্থায় `6px` (একটা বাক্স)।
 * আকৃতিটাই বলে দেয় ভেতরে আরও আছে কি না।
 */
function ItemList({ items }: { items: OrderItem[] }) {
  const [open, setOpen] = useState(false);
  const collapsible = items.length > 1;
  const visible = collapsible && !open ? items.slice(0, 1) : items;

  const rows = visible.map((item, index) => (
    <div key={item.id} className="flex min-w-0 items-center gap-2">
      {/* Frame 2147236278: 19×19, গোল, কালো, ভেতরে ক্রমিক সংখ্যা
          Sora 400 10px সাদা। */}
      <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-black font-sora text-[10px] font-normal leading-none text-white">
        {index + 1}
      </span>
      <span className="truncate font-sora text-[12px] font-normal leading-none text-black">
        {item.quantity}× {item.menuItem.title}
      </span>
    </div>
  ));

  if (!collapsible) {
    return (
      <div className="flex flex-col gap-1.5 rounded-full bg-[#F9F6F3] p-1.5">{rows}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-expanded={open}
      className={`flex w-full items-start gap-3.5 bg-[#F9F6F3] p-1.5 text-left transition-colors hover:bg-black/[0.06] ${
        open ? "rounded-[6px]" : "rounded-full"
      } ${FOCUS_RING}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">{rows}</span>
      <ChevronDown
        className={`mt-0.5 h-4 w-4 shrink-0 text-black transition-transform ${
          open ? "rotate-180" : ""
        }`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </button>
  );
}

function OrderCard({
  order,
  nowMs,
  action,
  isPending,
}: {
  order: KitchenOrder;
  nowMs: number;
  action: { label: string; onClick: () => void } | null;
  isPending: boolean;
}) {
  const isUrgent =
    order.status !== "OUT_FOR_DELIVERY" &&
    nowMs - new Date(order.createdAt).getTime() > URGENT_AFTER_MS;
  const isDineIn = order.orderType === "DINE_IN";

  return (
    /* Frame 2147236328: column, padding 16, gap 12, radius 20, সাদা। */
    <article className="flex flex-col gap-3 rounded-[20px] bg-white p-4">
      {/* Frame 2147236326: column, gap 14। */}
      <div className="flex flex-col gap-3.5">
        {/* Frame 2147236325: row, space-between। */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="truncate font-frank-ruhl text-[16px] font-medium leading-none text-black">
              {formatOrderId(order.id)}
            </p>
            <p className="truncate font-sora text-[12px] font-normal leading-none text-black/70">
              {order.firstName} {order.lastName}
              {isDineIn && ` · Table ${order.table?.label ?? "—"}`}
            </p>
          </div>

          {/**
           * Frame 2147236324: padding 6px 10px, radius 100, BG #F9F6F3,
           * লেখা Sora 400 12px।
           *
           * ⚠️ ১৫ মিনিটের পুরনো হলে লেখাটা লাল। Figma-তে এই অবস্থাটা
           * আঁকা নেই (ওখানে সব "14m ago"), কিন্তু রান্নাঘরের বোর্ডে
           * "কোনটা দেরি হচ্ছে" সবচেয়ে জরুরি তথ্য — আগের বোর্ডেও এটা
           * ছিল, তাই নকশা বদলানোর সময় ফেলে দেওয়া হয়নি।
           */}
          <span
            className={`shrink-0 whitespace-nowrap rounded-full bg-[#F9F6F3] px-2.5 py-1.5 font-sora text-[12px] font-normal leading-none ${
              isUrgent ? "text-[#D72A37]" : "text-black/70"
            }`}
          >
            {elapsedLabel(order.createdAt, nowMs)}
          </span>
        </div>

        <ItemList items={order.items} />
      </div>

      {/* Fill: row, 34px উঁচু, padding 10px 16px, radius 100, gradient,
          লেখা Sora 400 14px সাদা।

          ⚠️ gradient-টা `bg-gradient-to-r` দিয়ে হয় না: ওই utility মানে
          ঠিক 90deg আর দ্বিতীয় রঙ 100%-এ, অর্থাৎ ডান কিনারাতেই পুরো
          গোলাপি। Figma-তে গোলাপিটা 145.78%-এ — বোতামের **বাইরে**। */}
      {action ? (
        <button
          type="button"
          disabled={isPending}
          onClick={action.onClick}
          className={`flex h-[34px] w-full items-center justify-center rounded-full ${GRADIENT} px-4 font-sora text-[14px] font-normal leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${FOCUS_RING}`}
        >
          {action.label}
        </button>
      ) : (
        /**
         * ⚠️ "Ready" কলামে Figma-তে "Out for Delivery" লেখা একটা বোতাম
         * আঁকা, কিন্তু সেটা বসানো হয়নি — এবং কারণটা বলে রাখা দরকার।
         *
         * আমাদের status-এ `OUT_FOR_DELIVERY`-ই "Ready" কলাম, অর্থাৎ
         * ওই বোতামটা চাপলে যেতে হতো `DELIVERED`-এ। কিন্তু "পৌঁছেছে"
         * চিহ্ন দেওয়ার কাজ রাইডারের, রান্নাঘরের নয় — রান্নাঘরের পর্দা
         * থেকে সেটা করলে অর্ডার ভুলভাবে শেষ হয়ে যেত আর রাইডারের
         * তালিকা থেকে হারিয়ে যেত।
         *
         * তাই এখানে অর্ডারটা খোলার লিঙ্ক — export-এ ওই বোতামটার
         * নমুনা লেখাও আসলে "View Order"।
         */
        <Link
          href={`/admin/orders/${order.id}`}
          className={`flex h-[34px] w-full items-center justify-center rounded-full border border-black px-4 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white ${FOCUS_RING}`}
        >
          View Order
        </Link>
      )}
    </article>
  );
}

export default function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const placedIdsRef = useRef<Set<string>>(
    new Set(initialOrders.filter((o) => o.status === "PLACED").map((o) => o.id))
  );

  /**
   * ⚠️ server নতুন তালিকা পাঠালে (search/ছাঁকনি বদলালে page আবার
   * render হয়) সেটা মিলিয়ে নেওয়া — render চলাকালীন তুলনা করে, effect
   * থেকে নয়, কারণ effect-এর ভেতরে setState লিখলে
   * react-hooks/set-state-in-effect ভাঙে।
   */
  const [syncedInitial, setSyncedInitial] = useState(initialOrders);
  if (initialOrders !== syncedInitial) {
    setSyncedInitial(initialOrders);
    setOrders(initialOrders);
  }

  // প্রতি ৩০ সেকেন্ডে শুধু "কতক্ষণ আগে" লেখাগুলো তাজা করার জন্য
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/admin/kitchen/orders");
        if (!res.ok) return;
        const data = await res.json();
        const freshOrders: KitchenOrder[] = data.orders;

        const freshPlacedIds = new Set(
          freshOrders.filter((o) => o.status === "PLACED").map((o) => o.id)
        );
        const hasNewPlaced = [...freshPlacedIds].some((id) => !placedIdsRef.current.has(id));
        if (hasNewPlaced) playBeep();
        placedIdsRef.current = freshPlacedIds;

        setOrders(freshOrders);
      } catch {
        // network সমস্যা — পরের poll-এ আবার চেষ্টা
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function advanceStatus(orderId: string, nextStatus: "PREPARING" | "OUT_FOR_DELIVERY") {
    const prevOrders = orders;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) throw new Error("Failed to update order");
      } catch {
        setOrders(prevOrders); // ব্যর্থ হলে আগের অবস্থায় ফেরত
        toast.error("Couldn't update the order. Please try again.");
      }
    });
  }

  const columns = [
    {
      key: "placed",
      title: "Placed",
      orders: orders.filter((o) => o.status === "PLACED"),
      action: (order: KitchenOrder) => ({
        label: "Start Preparing",
        onClick: () => advanceStatus(order.id, "PREPARING"),
      }),
    },
    {
      key: "preparing",
      title: "Preparing",
      orders: orders.filter((o) => o.status === "PREPARING"),
      action: (order: KitchenOrder) => ({
        label: "Make Ready",
        onClick: () => advanceStatus(order.id, "OUT_FOR_DELIVERY"),
      }),
    },
    {
      key: "ready",
      title: "Ready",
      orders: orders.filter((o) => o.status === "OUT_FOR_DELIVERY"),
      action: null,
    },
  ];

  return (
    /**
     * Frame 2147236411: row, gap 12 — তিনটে কলাম।
     *
     * ⚠️ ১০২৪-এর নিচে এক কলামে নামে, পাশাপাশি নয়। ৩২০px-এ তিনটে কলাম
     * মানে প্রতিটা ~৯০px — অর্ডার নম্বরটাও আঁটে না। ট্যাবলেটে দুই
     * কলাম করা যেত, কিন্তু তাতে "Ready" নিচে একা পড়ে থাকত আর
     * বোর্ডের বাঁ-থেকে-ডান পড়ার ক্রমটাই ভেঙে যেত।
     */
    <div className="grid gap-3 lg:grid-cols-3">
      {columns.map((column) => (
        /* Frame 2147236335: column, padding 16, gap 20, radius 16,
           BG #F9F6F3। */
        <section
          key={column.key}
          className="flex min-w-0 flex-col gap-5 rounded-[16px] bg-[#F9F6F3] p-4"
        >
          <h3 className="font-frank-ruhl text-[20px] font-medium leading-none text-black">
            {column.title} ({column.orders.length})
          </h3>

          {/* Frame 2147236334: column, gap 16। */}
          <div className="flex flex-col gap-4">
            {column.orders.length === 0 ? (
              <p className="py-6 text-center font-sora text-[12px] leading-none text-black/70">
                No orders
              </p>
            ) : (
              column.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  nowMs={nowMs}
                  isPending={isPending}
                  action={column.action ? column.action(order) : null}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
