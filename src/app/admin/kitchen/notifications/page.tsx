import { requireStaff } from "@/lib/require-admin";
import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Notification" };

/**
 * src/app/admin/kitchen/notifications/page.tsx
 *
 * "Notification" in the Figma kitchen sidebar. A placeholder that stays inside
 * the "kitchen" scope, so the KITCHEN role gets a real page instead of being
 * bounced to /admin by the admin-only Notification page.
 */
export default async function KitchenNotificationsPage() {
  await requireStaff("kitchen");
  return (
    <ComingSoon
      title="Notification"
      description="Kitchen alerts — new tickets, low stock, delayed orders — are not built yet. New orders already appear live on the Live Orders board."
      action={{ label: "Back to Live Orders", href: "/admin/kitchen" }}
    />
  );
}
