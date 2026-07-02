import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import ReservationsToolbar from "./ReservationsToolbar";
import ReservationStatusSelect from "./ReservationStatusSelect";
import Pagination from "../orders/Pagination";

const PAGE_SIZE = 10;

export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim();
  const status = params.status;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.ReservationWhereInput = {
    ...(status && status !== "ALL"
      ? { status: status as Prisma.ReservationWhereInput["status"] }
      : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [reservations, totalCount] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy: { reservedAt: "asc" },
      include: { table: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.reservation.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Reservations</h1>

      <ReservationsToolbar />

      {reservations.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-md text-gray-500">
          No reservations match your filters.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white">
          {reservations.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-[140px]">
                <p className="text-sm font-medium text-gray-800">{r.customerName}</p>
                <p className="text-xs text-gray-400">{r.phone}</p>
              </div>

              <div className="text-sm text-gray-600">
                Table {r.table.label} · {r.guestCount} guest{r.guestCount > 1 ? "s" : ""}
              </div>

              <div className="text-sm text-gray-600">
                {r.reservedAt.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>

              <ReservationStatusSelect reservationId={r.id} currentStatus={r.status} />
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} searchParams={params} />
    </div>
  );
}