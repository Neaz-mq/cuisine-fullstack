import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";
import { findActiveDeliveries, toActiveDelivery } from "@/lib/rider-panel";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import { RiderPageHeader } from "../rider-ui";
import ActiveDeliveries from "./ActiveDeliveries";

export const metadata = { title: "Active Delivery" };

/**
 * Rider panel → Active Delivery (Figma): the orders the rider holds right
 * now — taken and waiting at the kitchen, or on the way — with the map,
 * progress, order and customer, and the chat.
 */
export default async function ActiveDeliveryPage() {
  const session = await requireStaff("myDeliveries");
  // Same pick-up point as the delivery fee and the customer's tracking map:
  // Settings' restaurant location, else the built-in one.
  const settings = await getRestaurantSettings();
  const origin =
    settings.restaurantLat !== null && settings.restaurantLng !== null
      ? { lat: settings.restaurantLat, lng: settings.restaurantLng }
      : { lat: RESTAURANT_LOCATION.lat, lng: RESTAURANT_LOCATION.lng };
  const rows = await findActiveDeliveries(session.user.id!);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={new Date()}
        actions={<ExportReportButton endpoint="/api/rider/export" forwardParams={[]} fallbackFilename="my-deliveries.csv" />}
      />
      <ActiveDeliveries initialDeliveries={rows.map(toActiveDelivery)} origin={origin} />
    </div>
  );
}
