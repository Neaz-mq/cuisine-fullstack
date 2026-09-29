import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { findActiveDeliveries, toActiveDelivery } from "@/lib/rider-panel";
import { RiderPageHeader } from "../rider-ui";
import ActiveDeliveries from "./ActiveDeliveries";

export const metadata = { title: "Active Delivery" };

/**
 * Rider panel → Active Delivery: the orders the rider holds right now —
 * taken and waiting at the kitchen, or on the way. (This was the whole
 * "My Deliveries" page before the rider panel got its own dashboard.)
 */
export default async function ActiveDeliveryPage() {
  const session = await requireStaff("myDeliveries");
  await getRestaurantSettings();
  const rows = await findActiveDeliveries(session.user.id!);

  return (
    <div className="flex flex-col gap-4">
      <RiderPageHeader
        title="Active Delivery"
        subtitle="Keep this page open while you're on the road — your location is shared with the customer automatically."
        now={new Date()}
      />
      <ActiveDeliveries initialDeliveries={rows.map(toActiveDelivery)} />
    </div>
  );
}
