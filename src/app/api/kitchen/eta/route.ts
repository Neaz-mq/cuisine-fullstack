import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  KITCHEN_QUEUE_STATUSES,
  calcKitchenPrepMinutes,
  calcShippingEta,
} from "@/lib/kitchen-eta";

// Public, unauthenticated — the checkout page (Carts.tsx) needs this before
// an order exists, often for a guest with no session at all. Deliberately
// returns only a queue-length-derived number, never the underlying order
// list — that stays behind admin auth on /api/admin/kitchen/orders.
//
// The Prisma query lives here (server-only route) rather than in
// src/lib/kitchen-eta.ts, because that file is also imported by the
// client component Carts.tsx — a Prisma import there breaks the browser
// build.
export async function GET() {
  const queueLength = await prisma.order.count({
    where: { status: { in: [...KITCHEN_QUEUE_STATUSES] } },
  });
  const kitchenPrepMinutes = calcKitchenPrepMinutes(queueLength);

  return NextResponse.json({
    kitchenPrepMinutes,
    etaByMethod: {
      UBER_EATS: calcShippingEta(kitchenPrepMinutes, "UBER_EATS"),
      FOOD_PANDA: calcShippingEta(kitchenPrepMinutes, "FOOD_PANDA"),
      OWN_DELIVERY: calcShippingEta(kitchenPrepMinutes, "OWN_DELIVERY"),
    },
  });
}