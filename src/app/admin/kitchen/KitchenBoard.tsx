"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "react-toastify";
import { formatOrderId } from "@/lib/format-order-id";

const POLL_INTERVAL_MS = 15000; // same cadence as NotificationBell
const URGENT_AFTER_MS = 15 * 60 * 1000; // highlight orders older than 15 min

type OrderItem = {
  id: string;
  quantity: number;
  menuItem: { title: string };
};

type KitchenOrder = {
  id: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY";
  firstName: string;
  lastName: string;
  createdAt: string;
  items: OrderItem[];
};

// Same "ping" tone as NotificationBell.tsx — kept as a local copy here since
// this component may render on a device where NotificationBell isn't mounted
// (a dedicated kitchen screen), so it can't rely on that instance's effect.
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
    // autoplay policy may block this silently — the visual board still updates
  }
}

function elapsedLabel(createdAt: string, nowMs: number) {
  const minutes = Math.floor((nowMs - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return "just now";
  return `${minutes}m ago`;
}

function OrderCard({
  order,
  nowMs,
  onAdvance,
  isPending,
}: {
  order: KitchenOrder;
  nowMs: number;
  onAdvance?: () => void;
  isPending: boolean;
}) {
  const isUrgent =
    order.status !== "OUT_FOR_DELIVERY" &&
    nowMs - new Date(order.createdAt).getTime() > URGENT_AFTER_MS;

  return (
    <div
      className={`bg-white rounded-md border p-3 ${
        isUrgent ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-800">{formatOrderId(order.id)}</p>
        <p className={`text-xs ${isUrgent ? "text-red-500 font-medium" : "text-gray-400"}`}>
          {elapsedLabel(order.createdAt, nowMs)}
        </p>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {order.firstName} {order.lastName}
      </p>

      <ul className="text-sm text-gray-700 space-y-0.5 mb-3">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-medium">{item.quantity}x</span> {item.menuItem.title}
          </li>
        ))}
      </ul>

      {onAdvance && (
        <button
          type="button"
          disabled={isPending}
          onClick={onAdvance}
          className="w-full text-xs font-semibold bg-[#FF4C15] text-white py-1.5 rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {order.status === "PLACED" ? "Start Preparing" : "Mark Ready"}
        </button>
      )}
    </div>
  );
}

export default function KitchenBoard({ initialOrders }: { initialOrders: KitchenOrder[] }) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const placedIdsRef = useRef<Set<string>>(
    new Set(initialOrders.filter((o) => o.status === "PLACED").map((o) => o.id))
  );

  // tick every 30s just to refresh elapsed-time labels / urgency highlighting
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
        // network error — silently retry on next poll
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function advanceStatus(orderId: string, nextStatus: "PREPARING" | "OUT_FOR_DELIVERY") {
    const prevOrders = orders;
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) throw new Error("Failed to update order");
      } catch {
        setOrders(prevOrders); // revert on failure
        toast.error("Couldn't update the order. Please try again.");
      }
    });
  }

  const placed = orders.filter((o) => o.status === "PLACED");
  const preparing = orders.filter((o) => o.status === "PREPARING");
  const ready = orders.filter((o) => o.status === "OUT_FOR_DELIVERY");

  const columns: {
    key: string;
    title: string;
    orders: KitchenOrder[];
    getAdvance?: (order: KitchenOrder) => (() => void) | undefined;
  }[] = [
    {
      key: "placed",
      title: `Placed (${placed.length})`,
      orders: placed,
      getAdvance: (order) => () => advanceStatus(order.id, "PREPARING"),
    },
    {
      key: "preparing",
      title: `Preparing (${preparing.length})`,
      orders: preparing,
      getAdvance: (order) => () => advanceStatus(order.id, "OUT_FOR_DELIVERY"),
    },
    {
      key: "ready",
      title: `Ready (${ready.length})`,
      orders: ready,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((column) => (
        <div key={column.key} className="bg-gray-100 rounded-md p-3">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">{column.title}</h2>
          <div className="space-y-3">
            {column.orders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No orders</p>
            ) : (
              column.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  nowMs={nowMs}
                  isPending={isPending}
                  onAdvance={column.getAdvance?.(order)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}