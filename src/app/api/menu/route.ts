import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * src/app/api/menu/route.ts
 *
 * GET /api/menu -> public, unauthenticated. Categories with their
 * available menu items, for the customer-facing /menu page.
 *
 * Replaces the hardcoded `categoryItems` array that used to live inline in
 * Items.tsx — see the "temporary shim" note in
 * src/lib/order-checkout-shared.ts for why that was a real correctness
 * risk (cart items were resolved by matching on `title`, not a real
 * MenuItem.id, because the frontend never had a real id to send).
 *
 * Only isAvailable items are returned — an item taken off the menu by
 * admin should never appear here in the first place, rather than showing
 * up greyed-out. (Order Again already handles the "item went unavailable
 * after the fact" case for existing orders — this is the equivalent
 * guarantee for browsing the live menu.)
 *
 * Categories with zero available items are omitted entirely, so the menu
 * never shows an empty category tab with nothing orderable inside it.
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const nonEmptyCategories = categories.filter((c) => c.menuItems.length > 0);

    // ⚠️ price-কে number-এ নামানো হচ্ছে, Decimal ছেড়ে দেওয়া হচ্ছে না।
    //
    // JSON.stringify একটা Prisma Decimal-কে string বানায় ("8.99"),
    // object নয়। Items.tsx এই response fetch করে `item.price.toFixed(2)`
    // ডাকে — string-এ toFixed নেই, তাই পুরো মেনু পাতা browser-এ ভেঙে
    // পড়ত। tsc এটা ধরতে পারত না, কারণ সে DB-র ধরনটাই জানে, নেটওয়ার্ক
    // পেরোনোর পরের রূপ নয়।
    //
    // এখানে float হওয়া নিরাপদ: এই দাম কেবল দেখানোর জন্য। গ্রাহক অর্ডার
    // করলে server নিজেই MenuItem.price আবার পড়ে (resolveOrderItems),
    // client-এর পাঠানো কোনো দাম কখনো বিশ্বাস করা হয় না।
    return NextResponse.json(
      nonEmptyCategories.map((c) => ({
        id: c.id,
        label: c.name,
        items: c.menuItems.map((item) => ({
          ...item,
          price: item.price.toNumber(),
        })),
      }))
    );
  } catch (error) {
    console.error("GET /api/menu error:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu" },
      { status: 500 }
    );
  }
}