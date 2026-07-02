import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * src/app/api/orders/mine/route.ts
 *
 * GET /api/orders/mine -> orders belonging to the currently logged-in user.
 *
 * Separate from GET /api/orders (which is ADMIN-only and returns every
 * order in the system) — this route is scoped to `session.user.id` so a
 * regular customer can only ever see their own history, never anyone
 * else's. Requires a session; guest orders (userId: null) are never
 * retrievable this way, which is expected since a guest has no account to
 * log back into.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { menuItem: true } } },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders/mine error:", error);
    return NextResponse.json(
      { error: "Failed to fetch your orders" },
      { status: 500 }
    );
  }
}