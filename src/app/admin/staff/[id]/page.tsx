import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { canManageStaffRole, canViewSensitiveStaffFields } from "@/lib/permissions";
import StaffForm from "../StaffForm";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin();
  const viewerId = session.user.id;
  const viewerRole = (session.user as { role?: string }).role;

  const member = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true },
  });

  if (!member || member.role === "CUSTOMER") {
    notFound();
  }

  // A MANAGER can't even open the edit form for an existing OWNER.
  if (!canManageStaffRole(viewerRole, member.role)) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Edit Staff</h1>
      <StaffForm
        viewerRole={viewerRole}
        isSelf={member.id === viewerId}
        canSeeSensitive={canViewSensitiveStaffFields(viewerRole)}
        existing={{
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          staffProfile: member.staffProfile
            ? {
                department: member.staffProfile.department,
                employmentType: member.staffProfile.employmentType,
                phone: member.staffProfile.phone,
                hireDate: member.staffProfile.hireDate.toISOString(),
                isActive: member.staffProfile.isActive,
                nid: member.staffProfile.nid,
                salary: member.staffProfile.salary,
              }
            : null,
        }}
      />
    </div>
  );
}
