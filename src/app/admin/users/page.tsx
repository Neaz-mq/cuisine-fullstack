import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import RoleSelect from "./RoleSelect";

export default async function AdminUsersPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true, reservations: true } },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Users</h1>

      {users.length === 0 ? (
        <p className="text-gray-500">No registered users yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-[180px]">
                <p className="text-sm font-medium text-gray-800">
                  {user.name ?? "—"}
                </p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>

              <span className="text-sm text-gray-600">
                {user._count.orders} order{user._count.orders !== 1 ? "s" : ""}
              </span>

              <span className="text-sm text-gray-600">
                {user._count.reservations} reservation
                {user._count.reservations !== 1 ? "s" : ""}
              </span>

              <span className="text-xs text-gray-400">
                Joined{" "}
                {user.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>

              <RoleSelect
                userId={user.id}
                currentRole={user.role}
                isSelf={user.id === session?.user?.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}