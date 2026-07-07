import { prisma } from "@/lib/prisma";
import KitchenBoard from "./KitchenBoard";

const READY_COLUMN_WINDOW_MS = 15 * 60 * 1000;

export default async function KitchenDisplayPage() {
  const readySince = new Date(Date.now() - READY_COLUMN_WINDOW_MS);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: { in: ["PLACED", "PREPARING"] } },
        { status: "OUT_FOR_DELIVERY", updatedAt: { gte: readySince } },
      ],
    },
    include: {
      items: {
        include: {
          menuItem: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Kitchen Display</h1>
      <KitchenBoard initialOrders={JSON.parse(JSON.stringify(orders))} />
    </div>
  );
}