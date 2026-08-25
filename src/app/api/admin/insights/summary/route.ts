// src/app/api/admin/insights/summary/route.ts
import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { generateWeeklySummary } from "@/lib/business-summary";
import { checkRateLimit } from "@/lib/rate-limit";
import { sum, type Money } from "@/lib/money";
import { getPricingSettings } from "@/lib/get-settings";

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
        select: { grandTotal: true, taxAmount: true, taxMode: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: startOfLastWeek, lt: startOfThisWeek },
          status: { not: "CANCELLED" },
        },
        select: { grandTotal: true, taxAmount: true, taxMode: true },
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

    // ── Revenue-এর ভিত্তি ────────────────────────────────────────────────
    //
    // ⚠️ ভিত্তি totalAmount নয়, ইচ্ছাকৃতভাবে। Money model আসার পর
    // totalAmount-এ কর আর বকশিশও ঢুকেছে — অথচ করের টাকা সরকারের, আর
    // বকশিশ কর্মীর। দুটোকেই "আয়" গুনলে মালিকের প্রতিটা রিপোর্ট ফুলে
    // যেতো, আর VAT ১৫% এমন দেশে ঠিক ততটাই বেশি, নিছক ভূগোলের কারণে।
    //
    // grandTotal হলো ছাপা বিল (বকশিশ ছাড়া)। তা থেকে কর বাদ দিলে যা
    // থাকে সেটাই রেস্তোরাঁর প্রকৃত বিক্রি — accountant একেই "net sales"
    // বলে।
    //
    // দুই tax mode-এই সূত্রটা এক, কারণ taxAmount সবসময় "এই order-এ কত
    // কর ছিল" বোঝায়: EXCLUSIVE-এ সেটা grandTotal-এ যোগ হয়েছিল,
    // INCLUSIVE-এ সেটা grandTotal-এর ভেতরেই ছিল। দুই ক্ষেত্রেই বাদ দিলে
    // কর-বহির্ভূত বিক্রি পাওয়া যায়।
    //
    // gift card বা point দিয়ে দেওয়া অংশ বাদ দেওয়া হয়নি — খাবার বিক্রি
    // হয়েছে, কেবল পরিশোধ আগে হয়েছিল। ওগুলো ছাড় নয়, পরিশোধের মাধ্যম।
    const netSales = (orders: { grandTotal: Money; taxAmount: Money }[]) =>
      sum(...orders.map((o) => o.grandTotal.minus(o.taxAmount)));

    const currentWeek = {
      revenue: netSales(thisWeekOrders),
      orders: thisWeekOrders.length,
    };
    const previousWeek = {
      revenue: netSales(lastWeekOrders),
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
      // মডেল যেন ডলার ধরে না নেয় — lib/business-summary.ts-এর
      // system prompt দ্রষ্টব্য।
      currency: (await getPricingSettings()).currency,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("POST /api/admin/insights/summary error:", error);

    /**
     * Groq প্রতি কয়েক মাসেই পুরোনো model বন্ধ করে দেয় (llama-3.3-70b
     * বন্ধ হয়েছে ১৬ আগস্ট ২০২৬-এ)। তখন প্রতিটা call 400
     * `model_decommissioned` দিয়ে ফেরে — কিন্তু নিচের সাধারণ বার্তাটা
     * সেটাকে "পরে চেষ্টা করুন" বানিয়ে দিত, অথচ পরে চেষ্টা করে কোনোদিনই
     * কাজ হতো না। এখন কারণটা সরাসরি বলা হয়, কারণ এই endpoint শুধু
     * insights-scope থাকা admin-ই ছুঁতে পারে — অর্থাৎ যিনি দেখবেন
     * তিনিই ঠিক করার লোক।
     *
     * duck-typing দিয়ে দেখা হচ্ছে, groq-sdk-এর APIError class import
     * করে নয়: এতে SDK-র version বদলালেও এই শর্তটা ভাঙে না।
     */
    const groqError =
      error && typeof error === "object" && "error" in error
        ? (error as { error?: { error?: { code?: string } } }).error?.error
        : undefined;

    if (groqError?.code === "model_decommissioned") {
      return NextResponse.json(
        {
          error:
            "The AI model this app uses has been retired by Groq. " +
            "Update GROQ_MODEL (or the default in lib/business-summary.ts) to a current model.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Couldn't generate a summary right now. Please try again shortly." },
      { status: 500 }
    );
  }
}