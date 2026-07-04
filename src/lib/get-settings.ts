import { prisma } from "@/lib/prisma";

/**
 * সবসময় একটাই settings row থাকে (id: "singleton")। যদি এখনো তৈরি না হয়ে
 * থাকে (fresh database), ডিফল্ট মান দিয়ে একটা তৈরি করে দেয়।
 */
export async function getRestaurantSettings() {
  const settings = await prisma.restaurantSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return settings;
}