import { NextResponse } from "next/server";
import { requireApiScope } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { toCsv } from "@/lib/csv";
import { getRestaurantSettings } from "@/lib/get-settings";
import { calculateFoodCost } from "@/lib/menu-profitability";
import {
  DEFAULT_MENU_STATUS,
  isMenuStatus,
  type MenuStatusFilter,
} from "@/lib/menu-status-filter";

/**
 * GET /api/admin/menu/export?q=&status=
 *
 * /admin/menu-এর "Export Report" — পর্দায় যা দেখা যাচ্ছে ঠিক সেটাই
 * নামে (একই search, একই status ছাঁকনি)।
 *
 * ⚠️ ছাঁকার যুক্তিটা admin/menu/page.tsx-এর হুবহু নকল, ইচ্ছাকৃতভাবে —
 * kitchen, inventory আর categories-এর export route-এও ঠিক এই কথাটা
 * লেখা আছে, একই কারণে: দুটো আলাদা হলে পর্দায় এক তালিকা আর ফাইলে
 * আরেকটা, আর সেই গরমিলটা কেউ ধরতে পারে না।
 *
 * ⚠️ `period` নেওয়া হয় না — ওটা কেবল Overview কার্ডের সংখ্যা বদলায়,
 * তালিকার কিছুই নয়। `page`-ও নেই, কারণ এই পাতায় pagination শ্রেণি-প্রতি
 * আর কেবল browser-এ; export মানে পুরো ছাঁকা তালিকা।
 *
 * টাকার ঘরগুলো **কাঁচা সংখ্যা**, মুদ্রা-চিহ্ন ছাড়া — "$8.99" লিখলে
 * Excel ওটাকে লেখা ধরত আর যোগ বা sort কিছুই করা যেত না। মুদ্রাটা
 * আলাদা একটা কলামে, একবার।
 */
export async function GET(request: Request) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  // বাকি export route-গুলোর একই সীমা।
  const rate = checkRateLimit(request, "menu-export", {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many exports. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const rawStatus = searchParams.get("status");
  // অচেনা মান চুপচাপ "সব" হয়ে যায় — URL হাতে বদলে দিলে error নয়।
  const status: MenuStatusFilter = isMenuStatus(rawStatus) ? rawStatus : DEFAULT_MENU_STATUS;

  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;

  const rows = await prisma.menuItem.findMany({
    orderBy: [{ category: { name: "asc" } }, { title: "asc" }],
    select: {
      title: true,
      description: true,
      price: true,
      isAvailable: true,
      createdAt: true,
      category: { select: { name: true } },
      calories: true,
      fatGrams: true,
      proteinGrams: true,
      carbGrams: true,
      prepTimeMinutes: true,
      ingredientTags: true,
      foodStatus: true,
      // recipe (InventoryItem + পরিমাণ) — food cost হিসাবের জন্য।
      ingredients: {
        select: {
          quantityRequired: true,
          inventoryItem: { select: { costPerUnit: true } },
        },
      },
    },
  });

  const visible = rows.filter((row) => {
    if (status === "available" && !row.isAvailable) return false;
    if (status === "unavailable" && row.isAvailable) return false;
    if (!q) return true;
    return (
      row.title.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
    );
  });

  /**
   * ⚠️ export-এ Food Cost থেকে গেছে, যদিও পর্দার তালিকায় ওই কলামটা
   * আর নেই (ওখানে এখন নকশার "Nutrition & Time")। CSV-র উদ্দেশ্য
   * পর্দার নকল করা নয়, spreadsheet-এ হিসাব করা — আর margin বার করার
   * সময় ঠিক এই দুটো কলামই লাগে।
   */
  const header = [
    "Category",
    "Item",
    "Description",
    "Price",
    "Currency",
    "Food Cost",
    "Food Cost %",
    "Kcal",
    "Fat (g)",
    "Protein (g)",
    "Carbs (g)",
    "Prep Time (min)",
    "Ingredients",
    "Food Status",
    "Status",
    "Added",
  ];

  const rowsOut = visible.map((row) => {
    const price = Number(row.price);
    const { foodCost, foodCostPercent, hasRecipe } = calculateFoodCost(
      row.ingredients.map((line) => ({
        quantityRequired: line.quantityRequired,
        costPerUnit: Number(line.inventoryItem.costPerUnit),
      })),
      price
    );

    return [
      row.category.name,
      row.title,
      row.description,
      price.toFixed(units),
      settings.currency,
      // ⚠️ recipe না থাকলে ফাঁকা, "0.00" নয় — spreadsheet-এ শূন্য মানে
      // "খরচ শূন্য", অথচ সত্যিটা হলো "খরচ জানা নেই"। গড় বার করলে
      // ওই শূন্যগুলোই হিসাবটা নষ্ট করত।
      hasRecipe ? foodCost.toFixed(units) : "",
      hasRecipe && foodCostPercent !== null ? foodCostPercent.toFixed(1) : "",
      // ⚠️ null মানে ফাঁকা ঘর, "0" নয় — spreadsheet-এ শূন্য একটা মান,
      // আর গড় বার করলে ওই শূন্যগুলোই হিসাবটা নষ্ট করত।
      row.calories === null ? "" : String(row.calories),
      row.fatGrams === null ? "" : String(row.fatGrams),
      row.proteinGrams === null ? "" : String(row.proteinGrams),
      row.carbGrams === null ? "" : String(row.carbGrams),
      row.prepTimeMinutes === null ? "" : String(row.prepTimeMinutes),
      // বিভাজক সেমিকোলন, কমা নয় — কমা হলে csvCell পুরো ঘরটা উদ্ধৃতিতে
      // মুড়ত (Excel ঠিকই পড়ত), কিন্তু চোখে দেখে কলামের কমা আর ভেতরের
      // কমা আলাদা করা যেত না। kitchen-এর export-এ একই সিদ্ধান্ত।
      row.ingredientTags.join("; "),
      row.foodStatus ?? "",
      row.isAvailable ? "Available" : "Unavailable",
      row.createdAt.toISOString(),
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(toCsv(header, rowsOut), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuisine-menu-${status}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
