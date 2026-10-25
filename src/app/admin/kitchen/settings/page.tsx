import { requireStaff } from "@/lib/require-admin";
import { getRestaurantSettings } from "@/lib/get-settings";
import ExportReportButton from "@/components/admin/dashboard/ExportReportButton";
import { RiderPageHeader } from "@/app/admin/my-deliveries/rider-ui";
import KitchenSettingsForm from "./KitchenSettingsForm";

export const metadata = { title: "Settings" };

/**
 * /admin/kitchen/settings (shown as /kitchen/settings) — the KITCHEN role's
 * Settings page, laid out like the Figma frame:
 *
 *   Welcome Back, <name>!                          [date] [Export Report]
 *   search …………………………………………………………………  [Save Change]
 *   Settings        Restaurant Time zone · Kitchen Opens · Kitchen Closes
 *   Notifications   Low Stock Alerts · Emergency Stock Alerts
 *
 * The values are the restaurant's own (RestaurantSettings), so what a cook
 * saves here is what the owner sees in Admin → Settings. Everything else on
 * that row — tax, currency, delivery fees — stays out of reach: the API
 * behind "Save Change" (/api/admin/kitchen/settings) takes only these five.
 *
 * The header is rendered here, on the server, because the date and the
 * Export button don't depend on what is being edited; only the search and
 * Save Change row (and the cards) belong to the client form.
 */
export default async function KitchenSettingsPage() {
  const [session, settings] = await Promise.all([requireStaff("kitchen"), getRestaurantSettings()]);

  return (
    <div className="flex flex-col gap-6">
      <RiderPageHeader
        name={session.user.name ?? undefined}
        now={new Date()}
        actions={
          <ExportReportButton
            endpoint="/api/admin/kitchen/settings/export"
            forwardParams={[]}
            fallbackFilename="kitchen-settings.csv"
          />
        }
      />

      <KitchenSettingsForm
        initial={{
          timezone: settings.timezone,
          kitchenOpenHour: settings.kitchenOpenHour,
          kitchenCloseHour: settings.kitchenCloseHour,
          lowStockAlerts: settings.lowStockAlerts,
          emergencyStockAlerts: settings.emergencyStockAlerts,
        }}
      />
    </div>
  );
}
