import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatOrderId } from "@/lib/format-order-id";
import { orderSearchFilter } from "@/lib/order-search";
import { isDashboardPeriod, periodStart } from "@/lib/dashboard-period";
import { RIDER_DELIVERY_SELECT, finishedWhere, toRiderDelivery } from "@/lib/rider-panel";
import { deliveryMinutes } from "@/lib/rider-stats";

/**
 * GET /api/rider/export?range=today|week|month|all&q= — "Export Report" on
 * the rider Dashboard and Delivery History: the signed-in rider's finished
 * deliveries as CSV (what the screen shows, every page of it).
 *
 * Only their own deliveries — the CSV is for checking pay with the
 * restaurant, so it carries fee, tip and cash, not the customer's phone.
 */
const MAX_ROWS = 5000;

export async function GET(request: Request) {
  const authResult = await requireApiScope("myDeliveries");
  if (authResult instanceof NextResponse) return authResult;

  const rate = checkRateLimit(request, "rider-export", { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  // Dashboard sends `range`; Delivery History sends its list period as `list`.
  const rawRange = searchParams.get("range") ?? searchParams.get("list");
  const range = isDashboardPeriod(rawRange) ? rawRange : "all";
  const search = orderSearchFilter(searchParams.get("q"));
  const rawStatus = searchParams.get("status");
  const status: "DELIVERED" | "CANCELLED" | null =
    rawStatus === "DELIVERED" ? "DELIVERED" : rawStatus === "CANCELLED" ? "CANCELLED" : null;
  const filters: Prisma.DeliveryTrackingWhereInput[] = [
    ...(search ? [{ order: search }] : []),
    ...(status ? [{ order: { status } }] : []),
  ];

  await getRestaurantSettings(); // restaurant time zone for "today"
  const rows = await prisma.deliveryTracking.findMany({
    where: {
      ...finishedWhere(authResult.user.id!, periodStart(range)),
      AND: filters,
    },
    orderBy: { assignedAt: "desc" },
    take: MAX_ROWS,
    select: RIDER_DELIVERY_SELECT,
  });

  const header = [
    "Order",
    "Status",
    "Customer",
    "Area",
    "Items",
    "Payment",
    "Order total",
    "Delivery fee",
    "Tip",
    "Your earning",
    "Currency",
    "Assigned at",
    "Picked up at",
    "Delivered at",
    "Minutes on the road",
    "Customer rating",
  ];

  const csvRows = rows.map(toRiderDelivery).map((d) => [
    formatOrderId(d.orderId),
    d.status === "DELIVERED" ? "Delivered" : "Cancelled",
    d.customerName,
    d.area,
    d.itemCount,
    d.paymentMethod === "COD" ? "Cash on delivery" : "Paid online",
    d.totalAmount.toFixed(2),
    d.deliveryFee.toFixed(2),
    d.tipAmount.toFixed(2),
    d.earning.toFixed(2),
    d.currency,
    d.assignedAt.toISOString(),
    d.pickedUpAt?.toISOString() ?? "",
    d.deliveredAt?.toISOString() ?? "",
    d.deliveredAt
      ? Math.round(deliveryMinutes({ assignedAt: d.assignedAt, pickedUpAt: d.pickedUpAt, deliveredAt: d.deliveredAt }))
      : "",
    d.rating ?? "",
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(header, csvRows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-deliveries-${range}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
