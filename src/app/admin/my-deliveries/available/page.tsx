import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/require-admin";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { ACTIVE_DELIVERY_WHERE, findAvailableOrders, MAX_ACTIVE_DELIVERIES, withoutAddress } from "@/lib/rider-panel";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import { RiderPageHeader } from "../rider-ui";
import AvailableOrders from "./AvailableOrders";

export const metadata = { title: "Available Orders" };

/**
 * Rider panel → Available Orders (Figma). Taking an order reserves it for
 * the rider; the customer hears "on the way" only at pick-up. Which orders
 * are listed: lib/rider-panel.ts (AVAILABLE_ORDER_WHERE).
 */
export default async function AvailableOrdersPage() {
  const session = await requireStaff("myDeliveries");
  const [orders, activeCount] = await Promise.all([
    findAvailableOrders(),
    prisma.deliveryTracking.count({ where: ACTIVE_DELIVERY_WHERE(session.user.id!) }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={new Date()}
        actions={
          <ExportReportButton endpoint="/api/rider/export" forwardParams={[]} fallbackFilename="my-deliveries.csv" />
        }
      />
      <AvailableOrders
        initial={{
          // The street address is shown only once the order is theirs.
          orders: orders.map(withoutAddress),
          activeCount,
          maxActive: MAX_ACTIVE_DELIVERIES,
        }}
        kitchenLabel="Cuisine — Main Kitchen"
        pickupLabel={`Cuisine Kitchen, ${RESTAURANT_LOCATION.label}`}
      />
    </div>
  );
}
