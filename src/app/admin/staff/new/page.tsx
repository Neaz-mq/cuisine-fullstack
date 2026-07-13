import { requireAdmin } from "@/lib/require-admin";
import { canViewSensitiveStaffFields } from "@/lib/permissions";
import StaffForm from "../StaffForm";

export default async function NewStaffPage() {
  const session = await requireAdmin();
  const viewerRole = (session.user as { role?: string }).role;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Add Staff</h1>
      <StaffForm
        viewerRole={viewerRole}
        isSelf={false}
        canSeeSensitive={canViewSensitiveStaffFields(viewerRole)}
      />
    </div>
  );
}
