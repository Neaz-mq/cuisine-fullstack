"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "react-toastify";
import { formatOrderId } from "@/lib/format-order-id";
import type { KitchenSort } from "@/lib/kitchen-status";
import OrderViewModal, { type OrderViewData } from "@/app/admin/orders/OrderViewModal";
import OrderDeliveryModal from "@/app/admin/orders/OrderDeliveryModal";

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
  /**
   * "View Order" আর "Ready to Delivery" modal-এর জন্য পুরো order —
   * ঠিকানা, চালান, ফি-ধাপ, বসানো rider। server-এ সাজানো (lib/
   * order-view-data.ts), orders টেবিল যেটা ব্যবহার করে ঠিক সেটাই।
   */
  view: OrderViewData;
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
  onView,
}: {
  order: KitchenOrder;
  nowMs: number;
  action: { label: string; onClick: () => void } | null;
  isPending: boolean;
  onView: () => void;
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
         * তাই এখানে অর্ডারটা খোলার বোতাম।
         *
         * ⚠️ আগে এটা `/admin/orders/<id>` পাতার একটা <Link> ছিল। সেই
         * পাতাটা ছিল সাদামাটা, আর তার চেয়ে বড় কথা — বোতামটা রান্নাঘরের
         * পর্দা থেকে staff-কে বের করে নিয়ে যেত। ব্যস্ত সময়ে ফিরে এসে
         * আবার sort/filter বসানো মানে হারানো সেকেন্ড। এখন orders
         * টেবিলের হুবহু একই modal, জায়গা ছেড়ে না গিয়েই।
         */
        <button
          type="button"
          onClick={onView}
          className={`flex h-[34px] w-full items-center justify-center rounded-full border border-black px-4 font-sora text-[14px] font-normal leading-none text-black transition-colors hover:bg-black hover:text-white ${FOCUS_RING}`}
        >
          View Order
        </button>
      )}
    </article>
  );
}

/**
 * সাজানোর নিয়মগুলো।
 *
 * ⚠️ ক্রমটা server-এ (page.tsx-এ) করা যেত না — এবং এটাই এখানে থাকার
 * আসল কারণ। বোর্ডটা প্রতি ১৫ সেকেন্ডে `/api/admin/kitchen/orders`
 * থেকে তালিকা এনে পুরোটা বদলে ফেলে; server-এ সাজালে প্রথম poll-এর
 * পরেই ক্রমটা হারিয়ে যেত আর ব্যবহারকারী দেখতেন pill-এ এক কথা লেখা
 * অথচ বোর্ড অন্যভাবে সাজানো।
 */
const SORTERS: Record<KitchenSort, (a: KitchenOrder, b: KitchenOrder) => number> = {
  oldest: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  /**
   * টেবিলের অর্ডার আগে, তারপর ডেলিভারি — আর **প্রতিটা দলের ভেতরে
   * পুরনোটাই আগে**। শুধু ধরন দিয়ে সাজালে একই দলের ভেতরে ক্রমটা
   * এলোমেলো হয়ে যেত, আর ন্যায্যতা (যে আগে দিয়েছেন, তিনি আগে পাবেন)
   * ভাঙত।
   */
  "dine-in": (a, b) => {
    const rank = (order: KitchenOrder) => (order.orderType === "DINE_IN" ? 0 : 1);
    return (
      rank(a) - rank(b) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },
};

export default function KitchenBoard({
  initialOrders,
  sort,
}: {
  initialOrders: KitchenOrder[];
  /** URL-এর `sort` param — তিনটে কলামেই একই নিয়মে খাটে। */
  sort: KitchenSort;
}) {
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

  /**
   * কোন অর্ডারটা কোন modal-এ খোলা — id, পুরো object নয়।
   *
   * ⚠️ কারণটা poll-এ: প্রতি ১৫ সেকেন্ডে পুরো তালিকা নতুন করে আসে। object
   * ধরে রাখলে modal-টা একটা জমে যাওয়া কপি দেখাত — rider বসানোর পরেও
   * dropdown ফাঁকা, ফি পুরনো। id ধরে রেখে প্রতি render-এ টাটকা তালিকা
   * থেকে খুঁজে নিলে modal নিজে থেকেই হালনাগাদ থাকে।
   */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

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

  /**
   * ⚠️ `[...orders]` — নকল করে তারপর sort। `Array.prototype.sort`
   * মূল array-টাকেই বদলে দেয়, আর এখানে সেটা React-এর state; state
   * সরাসরি বদলালে React ধরতেই পারে না যে কিছু বদলেছে।
   */
  const sorted = [...orders].sort(SORTERS[sort]);

  const columns = [
    {
      key: "placed",
      title: "Placed",
      orders: sorted.filter((o) => o.status === "PLACED"),
      action: (order: KitchenOrder) => ({
        label: "Start Preparing",
        onClick: () => advanceStatus(order.id, "PREPARING"),
      }),
    },
    {
      key: "preparing",
      title: "Preparing",
      orders: sorted.filter((o) => o.status === "PREPARING"),
      /**
       * ⚠️ ডেলিভারির অর্ডারে এটা সরাসরি status বদলায় না, modal খোলে।
       *
       * আগে এটা সোজা `OUT_FOR_DELIVERY`-তে PATCH করত, অর্থাৎ কোনো rider
       * বসানো ছাড়াই অর্ডারটা "পথে" হয়ে যেত: DeliveryTracking তৈরি হতো
       * না, তাই গ্রাহকের /track পাতায় কোনো map বা rider থাকত না, আর
       * chat-ও খুলত না। দূরত্ব-ভিত্তিক delivery ফি-ও বসত না।
       *
       * এখন orders টেবিলের হুবহু একই modal — যেটা rider বসানো, ফি হিসাব
       * আর status বদল তিনটেই এক request-এ করে (assign-rider route)।
       *
       * ⚠️ dine-in ব্যতিক্রম: ওখানে কোনো rider নেই, "Ready" মানে শুধু
       * পরিবেশনের জন্য তৈরি। তাই ওটা আগের মতোই সরাসরি PATCH।
       */
      action: (order: KitchenOrder) =>
        order.orderType === "DINE_IN"
          ? {
              label: "Mark Ready",
              onClick: () => advanceStatus(order.id, "OUT_FOR_DELIVERY"),
            }
          : {
              label: "Ready to Delivery",
              onClick: () => setDispatchingId(order.id),
            },
    },
    {
      key: "ready",
      title: "Ready",
      orders: sorted.filter((o) => o.status === "OUT_FOR_DELIVERY"),
      action: null,
    },
  ];

  /**
   * ⚠️ প্রতি render-এ টাটকা তালিকা থেকে খুঁজে নেওয়া হয়, state-এ জমিয়ে
   * রাখা হয় না — উপরে `viewingId`/`dispatchingId`-এর মন্তব্য দ্রষ্টব্য।
   * খোলা অর্ডারটা যদি poll-এর পর তালিকা থেকে চলে যায় (যেমন "Ready"
   * কলামের ১৫ মিনিটের জানালা পেরিয়ে গেল), modal নিজে থেকেই বন্ধ হয়ে
   * যায় — একটা বাসি কপি খোলা রেখে দেওয়ার চেয়ে সেটাই ঠিক।
   */
  const viewing = orders.find((order) => order.id === viewingId) ?? null;
  const dispatching = orders.find((order) => order.id === dispatchingId) ?? null;

  return (
    <>
      {/**
        * Frame 2147236411: row, gap 12 — তিনটে কলাম।
        *
        * ⚠️ ১০২৪-এর নিচে এক কলামে নামে, পাশাপাশি নয়। ৩২০px-এ তিনটে কলাম
        * মানে প্রতিটা ~৯০px — অর্ডার নম্বরটাও আঁটে না। ট্যাবলেটে দুই
        * কলাম করা যেত, কিন্তু তাতে "Ready" নিচে একা পড়ে থাকত আর
        * বোর্ডের বাঁ-থেকে-ডান পড়ার ক্রমটাই ভেঙে যেত।
        */}
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
                  onView={() => setViewingId(order.id)}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>

      {/**
        * ⚠️ modal দুটো orders টেবিলের হুবহু একই component — নতুন করে লেখা
        * হয়নি। "Ready to Delivery" চাপলে যা হয় তার পুরোটাই
        * OrderDeliveryModal-এর ভেতরে: rider বাছা → POST /api/admin/orders/
        * <id>/assign-rider → সেই একটা route-ই দূরত্ব মাপে, ফি বসায়,
        * DeliveryTracking তৈরি করে আর অর্ডারকে OUT_FOR_DELIVERY-তে নেয়।
        *
        * ⚠️ সফল হলে `onDone` — board-এর নিজের তালিকা সাথে সাথে হালনাগাদ
        * করা হয়, পরের poll-এর ১৫ সেকেন্ড অপেক্ষা না করে। নাহলে staff
        * বোতাম চেপে কার্ডটাকে "Preparing" কলামেই বসে থাকতে দেখতেন আর
        * দ্বিতীয়বার চাপতেন।
        */}
      <OrderViewModal
        open={viewing !== null}
        onClose={() => setViewingId(null)}
        order={viewing?.view ?? EMPTY_VIEW}
      />
      {dispatching && (
        <OrderDeliveryModal
          open
          onClose={() => setDispatchingId(null)}
          orderId={dispatching.id}
          order={dispatching.view}
          onDone={() => {
            setDispatchingId(null);
            setOrders((prev) =>
              prev.map((order) =>
                order.id === dispatching.id
                  ? { ...order, status: "OUT_FOR_DELIVERY" as const }
                  : order
              )
            );
          }}
        />
      )}
      </>
  );
}

/**
 * OrderViewModal সবসময় mount থাকে (`open` দিয়ে দেখানো/লুকানো), তাই
 * বন্ধ অবস্থায় একটা খালি order লাগে।
 *
 * ⚠️ `open` false হলে modal কিছুই render করে না, তাই এই মানগুলো কখনো
 * পর্দায় আসে না — কিন্তু `order` prop-টা optional করে দিলে ভেতরের
 * প্রতিটা field-এ null check বসাতে হতো, যেটা আসল ব্যবহারের জায়গায়
 * (orders টেবিল) কোনো কাজেই লাগত না।
 */
const EMPTY_VIEW: OrderViewData = {
  id: "",
  reference: "",
  email: null,
  phone: "",
  address: null,
  items: [],
  channel: "",
  paymentLabel: "",
  totalLabel: "",
  deliveryFeeLabel: "",
  riderId: null,
  delivery: null,
};
