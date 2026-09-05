import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { createMenuItemSchema } from "@/lib/validations/menu-item";

export async function POST(req: NextRequest) {
  const authResult = await requireApiScope("menu");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, createMenuItemSchema);
  if (parsed instanceof NextResponse) return parsed;

  /**
   * ⚠️ মাঠগুলো একটা একটা করে লেখা, `data: parsed` নয় — ইচ্ছাকৃতভাবে।
   * এটাই আগের mass-assignment ফাঁকটা বন্ধ করেছিল, আর নতুন মাঠ যোগ
   * হলে সেগুলোও এখানে **হাতে** লিখতে হয়। একটু বেশি টাইপ, কিন্তু কোন
   * কোন কলাম client-এর নিয়ন্ত্রণে সেটা এক নজরেই পড়া যায়।
   */
  const {
    title,
    description,
    price,
    imageUrl,
    categoryId,
    isAvailable,
    calories,
    fatGrams,
    proteinGrams,
    carbGrams,
    ingredientTags,
    foodStatus,
    prepTimeMinutes,
  } = parsed;

  const item = await prisma.menuItem.create({
    data: {
      title,
      description,
      price,
      imageUrl: imageUrl || null,
      categoryId,
      isAvailable,
      // `?? null` — schema-য় মাঠগুলো nullable, আর `undefined` পাঠালে
      // Prisma ওগুলো বাদ দিয়ে দেয় (create-এ ফল একই, কিন্তু স্পষ্ট
      // থাকাই ভালো)।
      calories: calories ?? null,
      fatGrams: fatGrams ?? null,
      proteinGrams: proteinGrams ?? null,
      carbGrams: carbGrams ?? null,
      // String[] কলামে null বসে না — না দিলে খালি array।
      ingredientTags: ingredientTags ?? [],
      foodStatus: foodStatus ?? null,
      prepTimeMinutes: prepTimeMinutes ?? null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
