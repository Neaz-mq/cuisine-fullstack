import Link from "next/link";
import { Check } from "lucide-react";
import { orderStepIndex, orderSteps, type OrderTypeValue } from "@/lib/account";
import { orderStatusLabel } from "@/lib/order-status-filter";
import { GRADIENT, SMALL_PRIMARY, STATUS_PILL } from "./ui";

/**
 * An order the customer is still waiting for: where it is (4 steps,
 * like the food apps), what's in it, and a Track button that opens the
 * live tracking page with the map.
 */
export default function LiveOrderCard({
  order,
}: {
  order: {
    id: string;
    reference: string;
    status: string;
    orderType: OrderTypeValue;
    placedLabel: string;
    itemsLabel: string;
    totalLabel: string;
  };
}) {
  const steps = orderSteps(order.orderType);
  const current = orderStepIndex(order.status);

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-[20px] bg-[#F9F6F3] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="font-frank-ruhl text-[20px] font-semibold leading-[1.14] tracking-[-0.01em] text-black">{order.reference}</p>
          <p className="mt-1 font-sora text-[13px] text-black/70">{order.placedLabel}</p>
        </div>
        <span className={`rounded-full px-3.5 py-1.5 font-sora text-[12px] font-semibold ${STATUS_PILL[order.status] ?? "bg-white text-black"}`}>
          {orderStatusLabel(order.status, order.orderType)}
        </span>
      </div>

      <ol className="grid grid-cols-4 gap-1.5" aria-label="Order progress">
        {steps.map((step, index) => {
          const done = index <= current;
          return (
            <li key={step} className="flex min-w-0 flex-col gap-2">
              <span
                className={`h-1.5 rounded-full ${done ? GRADIENT : "bg-white"}`}
                aria-hidden="true"
              />
              <span
                className={`flex items-center gap-1 font-sora text-[10px] leading-tight min-[480px]:text-[11px] ${
                  index === current ? "font-semibold text-black" : done ? "text-black/70" : "text-black/40"
                }`}
              >
                {done && index < current && <Check className="hidden h-3 w-3 shrink-0 min-[480px]:block" aria-hidden="true" />}
                {step}
                {index === current && <span className="sr-only"> (current step)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-black/10 pt-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-sora text-[12px] leading-[1.5] text-black/70">{order.itemsLabel}</p>
          <p className="mt-1 font-frank-ruhl text-[18px] font-semibold text-black">{order.totalLabel}</p>
        </div>
        <Link href={`/track/${order.id}`} className={SMALL_PRIMARY}>
          Track order
        </Link>
      </div>
    </article>
  );
}
