// src/app/api/admin/insights/summary/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { generateWeeklySummary } from "@/lib/business-summary";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/insights/summary
 *
 * Computes this-week-vs-last-week sales numbers server-side (never trusts
 * anything from the client — there's no request body at all) and asks
 * Groq to narrate them into a short summary for the dashboard's "AI
 * Business Summary" card. Generated on demand via a button click rather
 * than automatically on every dashboard load, both to keep the dashboard
 * itself fast (no request blocks on an LLM call) and to keep this
 * comfortably inside a free-tier request budget — a restaurant owner
 * checking this a handful of times a day is nowhere near any Groq free
 * tier limit, an accidental refresh-loop or shared/public deployment
 * might be, hence the rate limit below.
 */
export async function POST(request: Request) {
  const authResult = await requireApiScope("insights");
  if (authResult instanceof NextResponse) return authResult;

  const rateLimit = checkRateLimit(request, "admin-ai-summary", {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - 6);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  try {
    const [thisWeekOrders, lastWeekOrders, cancelledThisWeek, topItemLines] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfThisWeek }, status: { not: "CANCELLED" } },
        select: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: startOfLastWeek, lt: startOfThisWeek },
          status: { not: "CANCELLED" },
        },
        select: { totalAmount: true },
      }),
      prisma.order.count({
        where: { createdAt: { gte: startOfThisWeek }, status: "CANCELLED" },
      }),
      // Same "unit price * quantity, aggregated in JS" approach as
      // admin/page.tsx and admin/insights/page.tsx — OrderItem.price is a
      // unit price, not a line total, so a raw DB-side sum would
      // undercount any item ordered with quantity > 1.
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: startOfThisWeek }, status: { not: "CANCELLED" } } },
        select: { menuItemId: true, quantity: true },
      }),
    ]);

    const currentWeek = {
      revenue: thisWeekOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      orders: thisWeekOrders.length,
    };
    const previousWeek = {
      revenue: lastWeekOrders.reduce((sum, o) => sum + o.totalAmount, 0),
      orders: lastWeekOrders.length,
    };

    const quantityByItem = new Map<string, number>();
    topItemLines.forEach((line) => {
      quantityByItem.set(line.menuItemId, (quantityByItem.get(line.menuItemId) ?? 0) + line.quantity);
    });
    let topItem: { title: string; quantity: number } | null = null;
    if (quantityByItem.size > 0) {
      const [topId, topQuantity] = [...quantityByItem.entries()].sort((a, b) => b[1] - a[1])[0];
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: topId },
        select: { title: true },
      });
      topItem = { title: menuItem?.title ?? "Unknown item", quantity: topQuantity };
    }

    const summary = await generateWeeklySummary({
      currentWeek,
      previousWeek,
      topItem,
      cancelledThisWeek,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("POST /api/admin/insights/summary error:", error);
    return NextResponse.json(
      { error: "Couldn't generate a summary right now. Please try again shortly." },
      { status: 500 }
    );
  }
}