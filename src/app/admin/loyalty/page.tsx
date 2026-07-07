import { prisma } from "@/lib/prisma";
import LoyaltyAdjustRow from "./LoyaltyAdjustRow";

export default async function AdminLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();

  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, loyaltyPoints: true },
    orderBy: { loyaltyPoints: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Loyalty Points</h1>

      <form className="mb-6" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by customer name or email..."
          className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF4C15]/30 focus:border-[#FF4C15]"
        />
      </form>

      {users.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No customers found.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {users.map((user) => (
            <LoyaltyAdjustRow
              key={user.id}
              userId={user.id}
              name={user.name}
              email={user.email}
              initialPoints={user.loyaltyPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}