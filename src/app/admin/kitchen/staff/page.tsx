import { requireStaff } from "@/lib/require-admin";
import ComingSoon from "@/components/admin/ComingSoon";

export const metadata = { title: "Staff" };

/**
 * src/app/admin/kitchen/staff/page.tsx
 *
 * "Staff" in the Figma kitchen sidebar. A placeholder that stays inside
 * the "kitchen" scope, so the KITCHEN role gets a real page instead of being
 * bounced to /admin by the admin-only Staff page.
 */
export default async function KitchenStaffPage() {
  await requireStaff("kitchen");
  return (
    <ComingSoon
      title="Staff"
      description="The kitchen team roster and shifts are not built yet. Your own details are under Settings."
      action={{ label: "Back to Live Orders", href: "/admin/kitchen" }}
    />
  );
}
