import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { canViewSensitiveStaffFields } from "@/lib/permissions";
import DeactivateStaffButton from "./DeactivateStaffButton";

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  WAITER: "bg-teal-100 text-teal-700",
  CASHIER: "bg-amber-100 text-amber-700",
  DELIVERY: "bg-orange-100 text-orange-700",
  KITCHEN: "bg-rose-100 text-rose-700",
};

export default async function AdminStaffPage() {
  const session = await requireAdmin();
  const viewerId = session.user.id;
  const viewerRole = (session.user as { role?: string }).role;
  const canSeeSensitive = canViewSensitiveStaffFields(viewerRole);

  const staff = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    orderBy: { createdAt: "asc" },
    include: { staffProfile: true },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Staff</h1>
        <Link
          href="/admin/staff/new"
          className="bg-[#FF4C15] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-orange-600 transition-colors"
        >
          + Add Staff
        </Link>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No staff members yet.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {staff.map((member) => {
            const isSelf = member.id === viewerId;
            return (
              <div
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-[180px]">
                  <p className="text-sm font-medium text-gray-800">
                    {member.name ?? "—"}
                    {isSelf && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                </div>

                <span className="text-xs font-mono text-gray-500">
                  {member.staffProfile?.employeeId ?? "—"}
                </span>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    ROLE_STYLES[member.role] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {member.role}
                </span>

                {member.staffProfile?.department && (
                  <span className="text-sm text-gray-600">{member.staffProfile.department}</span>
                )}

                {canSeeSensitive && member.staffProfile?.salary != null && (
                  <span className="text-sm text-gray-600">
                    ${member.staffProfile.salary.toFixed(2)}/mo
                  </span>
                )}

                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    member.staffProfile?.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {member.staffProfile?.isActive ? "Active" : "Inactive"}
                </span>

                <div className="flex items-center gap-3 ml-auto">
                  <Link
                    href={`/admin/staff/${member.id}`}
                    className="text-sm text-[#2C6252] font-medium hover:underline"
                  >
                    Edit
                  </Link>
                  {!isSelf && member.staffProfile && (
                    <DeactivateStaffButton
                      userId={member.id}
                      isActive={member.staffProfile.isActive}
                      name={member.name ?? member.email}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
