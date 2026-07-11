"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChefHat, Truck, PackageCheck, Circle, XCircle } from "lucide-react";
import { formatOrderId } from "@/lib/format-order-id";

const POLL_INTERVAL_MS = 15000; // same cadence as the admin Kitchen board

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  menuItem: { title: string };
};

type TrackedOrder = {
  id: string;
  status: "PLACED" | "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  firstName: string;
  city: string | null;
  orderType: "DELIVERY" | "DINE_IN";
  shippingMethod: "UBER_EATS" | "FOOD_PANDA" | null;
  table: { label: string } | null;
  items: OrderItem[];
};

// A dine-in order was never "out for delivery" — same backend status value,
// just a different customer-facing label/icon story for that step (see
// project notes on Order.status).
function stepsFor(orderType: "DELIVERY" | "DINE_IN") {
  return [
    { key: "PLACED", label: "Order Placed", icon: CheckCircle2 },
    { key: "PREPARING", label: "Preparing", icon: ChefHat },
    {
      key: "OUT_FOR_DELIVERY",
      label: orderType === "DINE_IN" ? "Ready to Serve" : "Out for Delivery",
      icon: orderType === "DINE_IN" ? PackageCheck : Truck,
    },
    { key: "DELIVERED", label: orderType === "DINE_IN" ? "Served" : "Delivered", icon: PackageCheck },
  ] as const;
}

export default function OrderTrackingTimeline({ initialOrder }: { initialOrder: TrackedOrder }) {
  const [order, setOrder] = useState<TrackedOrder>(initialOrder);

  useEffect(() => {
    if (order.status === "DELIVERED" || order.status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setOrder(data);
      } catch {
        // network error — silently retry on the next poll
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [order.id, order.status]);

  const isDineIn = order.orderType === "DINE_IN";
  const STEPS = stepsFor(order.orderType);

  if (order.status === "CANCELLED") {
    return (
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">
          {formatOrderId(order.id)}
        </h1>
        <div className="mt-6 border border-red-200 bg-red-50 rounded-md p-6 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="font-semibold text-red-700">This order was cancelled</p>
            <p className="text-sm text-red-500">
              If this wasn&apos;t expected, please contact us for help.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div>
      <p className="text-sm text-gray-400 mb-1">Tracking order</p>
      <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-1">
        {formatOrderId(order.id)}
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Hi {order.firstName}, here&apos;s the live status of your order.
      </p>

      {/* Timeline */}
      <div className="flex items-start justify-between mb-10">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {index > 0 && (
                <div
                  className={`absolute top-5 right-1/2 w-full h-0.5 -z-10 ${
                    index <= currentStepIndex ? "bg-[#2C6252]" : "bg-gray-200"
                  }`}
                />
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white ${
                  isComplete || isCurrent
                    ? "border-[#2C6252] text-[#2C6252]"
                    : "border-gray-200 text-gray-300"
                } ${isCurrent ? "animate-pulse" : ""}`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isUpcoming ? (
                  <Circle className="w-4 h-4" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <p
                className={`text-xs mt-2 text-center px-1 ${
                  isComplete || isCurrent ? "text-gray-800 font-medium" : "text-gray-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {order.status !== "DELIVERED" && (
        <p className="text-center text-sm text-gray-400 mb-8">
          This page updates automatically — no need to refresh.
        </p>
      )}
      {order.status === "DELIVERED" && (
        <p className="text-center text-sm font-medium text-[#2C6252] mb-8">
          {isDineIn ? "Served — enjoy your meal! 🎉" : "Delivered — enjoy your meal! 🎉"}
        </p>
      )}

      {/* Order summary */}
      <div className="border border-gray-200 rounded-md p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Order Summary
        </h2>
        <div className="space-y-2 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700">
              <span>
                {item.menuItem.title} <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-200">
          <span className="text-sm text-gray-500">
            {isDineIn
              ? `Table ${order.table?.label ?? "—"}`
              : `${order.shippingMethod === "UBER_EATS" ? "Uber Eats" : "Food Panda"} \u00b7 ${order.city ?? ""}`}
          </span>
          <span className="font-bold text-[#2C6252]">USD ${order.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/menu" className="text-sm text-[#FF4C15] font-medium hover:underline">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}
