import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

// engineType = "client" (দেখুন schema.prisma) হওয়ায় PrismaClient-কে
// adapter ছাড়া তৈরি করা যায় না — ব্যাখ্যা src/lib/prisma.ts-এ।
//
// seed আলাদা প্রসেসে চলে (tsx prisma/seed.ts), তাই prisma.config.ts-এর
// "dotenv/config" এখানে পৌঁছায় না — নিজেরই .env পড়তে হয়।
// বাকি CLI কাজের মতোই DIRECT_URL (session pooler) কে অগ্রাধিকার —
// seed একটা লম্বা, বহু-statement কাজ, transaction pooler-এর জন্য নয়।
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Category list 
// ---------------------------------------------------------------------------
// ক্রমটাই মেনুতে দেখানোর ক্রম — নিচের সূচক থেকে Category.sortOrder বসে।
const categories = [
  "Appetizer",
  "Burgers",
  "Chicken",
  "Pizza",
  "Coffee",
  "Drinks",
];

// ---------------------------------------------------------------------------
// Menu items 
// price
// ---------------------------------------------------------------------------
const menuItems = [
  // ---- Items.jsx: BURGERS ----
  {
    title: "Fresh Burger",
    description:
      "We source only the freshest and highest-quality ingredients to ensure every dish bursts with flavor.",
    price: 8.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Burgers",
  },
  {
    title: "Juicy Burger",
    description:
      "Our signature beef patty, cooked to perfection and served on a toasted bun with fresh veggies.",
    price: 9.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Burgers",
  },
  {
    title: "Spicy BBQ Burger",
    description:
      "A smoky and spicy delight with a zesty BBQ sauce, crispy onions, and melted cheese.",
    price: 9.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Burgers",
  },
  {
    title: "Mushroom Swiss Burger",
    description:
      "Earthy mushrooms and melted Swiss cheese complement our succulent beef patty perfectly.",
    price: 9.29,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Burgers",
  },

  // ---- Items.jsx: CHICKEN ----
  {
    title: "Crispy Fried Chicken",
    description:
      "Our chicken is fried to golden perfection, crispy on the outside, juicy on the inside, a true delight.",
    price: 7.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Spicy Chicken Wings",
    description:
      "Experience the fiery kick of our spicy chicken wings, perfect for those who love a bit of heat.",
    price: 8.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Grilled Chicken Salad",
    description:
      "Healthy and delicious, our grilled chicken salad is packed with fresh greens and tender chicken.",
    price: 6.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Chicken Nuggets Meal",
    description:
      "A perfect meal for the little ones, tender chicken nuggets with a side of crispy fries.",
    price: 5.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },

  // ---- Items.jsx: PIZZA ----
  {
    title: "Classic Pepperoni Pizza",
    description:
      "A timeless favorite with rich tomato sauce, mozzarella, and savory pepperoni slices.",
    price: 13.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
    category: "Pizza",
  },
  {
    title: "Margherita Delight",
    description:
      "Simple yet perfect, with fresh basil, mozzarella, and a hint of olive oil on a crispy crust.",
    price: 11.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
    category: "Pizza",
  },
  {
    title: "Veggie Supreme Pizza",
    description:
      "Loaded with a colorful array of fresh vegetables, olives, and bell peppers.",
    price: 12.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
    category: "Pizza",
  },
  {
    title: "Chicken BBQ Pizza",
    description:
      "Tangy BBQ sauce, grilled chicken, red onions, and cilantro create a unique flavor.",
    price: 14.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
    category: "Pizza",
  },

  // ---- Items.jsx: APPETIZER ----
  {
    title: "Crispy French Fries",
    description:
      "Golden, crispy, and perfectly salted french fries, a classic appetizer.",
    price: 4.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Onion Rings Sauce",
    description:
      "Sweet and savory onion rings, deep-fried to perfection, served with a special dipping sauce.",
    price: 5.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Mozzarella Sticks",
    description:
      "Warm, gooey mozzarella sticks coated in crispy breading, served with marinara.",
    price: 6.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Garlic Bread with Cheese",
    description:
      "Toasted garlic bread topped with melted cheese, a perfect companion to any meal.",
    price: 5.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },

  // ---- Items.jsx: DRINKS ----
  {
    title: "Classic Coca-Cola",
    description:
      "The refreshing taste of Coca-Cola, perfectly chilled to quench your thirst.",
    price: 2.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Freshly Squeezed Orange Juice",
    description:
      "Natural and invigorating, our freshly squeezed orange juice is a burst of citrus flavor.",
    price: 3.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Creamy Vanilla Milkshake",
    description:
      "Indulge in our rich and creamy vanilla milkshake, a sweet treat for any time.",
    price: 3.49,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Iced Lemon Tea",
    description:
      "Cool down with our refreshing iced lemon tea, perfectly balanced between sweet and tart.",
    price: 2.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },

  // ---- Category.jsx: Coffee ----
  {
    title: "Cappuccino Creamy",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Coffee",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 13,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Italian",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Mozila",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 11,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Cup",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Brazilian",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 8,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    title: "Cappuccino Latte",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 7,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },

  // ---- Category.jsx: Pizza 
  {
    title: "Pepperoni Pizza",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 26,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Mojito",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 22,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Deluxe",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 20,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Supreme",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 18,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Special",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Fieasta",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    title: "Pepperoni Normal",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
];

async function main() {
  console.log("🌱 Starting seed...");

  // 1) Create all Category rows (upsert — skip if exists, create if not)
  const categoryMap = new Map<string, string>(); // name -> id

  for (let index = 0; index < categories.length; index++) {
    const name = categories[index];
    const sortOrder = index + 1;
    const category = await prisma.category.upsert({
      where: { name },
      update: { sortOrder },
      create: { name, sortOrder },
    });
    categoryMap.set(name, category.id);
  }
  console.log(`✅ ${categories.length} Category rows created/confirmed`);

  // 2) Create MenuItem rows — capped at SEED_ITEMS_PER_CATEGORY per category
  //
  // The full source list (menuItems) has 34 items across 6 categories.
  // For local/testing purposes we only need a handful per category, not the
  // whole set — so we take the first N per category here. Bump this number
  // (or seed the full `menuItems` array directly) whenever real menu data
  // is needed.
  //
  // MenuItem has no natural unique key (unlike Category.name or
  // RestaurantTable.label), so a Prisma-level upsert({ where: { title } })
  // isn't possible here. We emulate one instead: look up each seed item by
  // title, UPDATE it if it already exists (so re-running the seed refreshes
  // price/description/image without touching its id — real Orders still
  // point at the same MenuItem row), or CREATE it if it doesn't.
  //
  // Anything left in the MenuItem table that ISN'T in this run's seed list
  // (e.g. an old item renamed or removed from the source array) is only
  // deleted if zero OrderItems reference it. Items that real Orders have
  // referenced are left alone — a deleteMany({}) here would throw a
  // foreign-key error (OrderItem_menuItemId_fkey) the moment any real order
  // has ever been placed, which is exactly what this replaces.
  const SEED_ITEMS_PER_CATEGORY = 3;

  const itemsPerCategoryCount = new Map<string, number>();
  const trimmedMenuItems = menuItems.filter((item) => {
    const usedSoFar = itemsPerCategoryCount.get(item.category) ?? 0;
    if (usedSoFar >= SEED_ITEMS_PER_CATEGORY) return false;
    itemsPerCategoryCount.set(item.category, usedSoFar + 1);
    return true;
  });

  const existingItems = await prisma.menuItem.findMany({
    select: { id: true, title: true, _count: { select: { orderItems: true } } },
  });
  const existingByTitle = new Map(existingItems.map((i) => [i.title, i]));
  const seededTitles = new Set(trimmedMenuItems.map((i) => i.title));

  let createdCount = 0;
  let updatedCount = 0;
  for (const item of trimmedMenuItems) {
    const categoryId = categoryMap.get(item.category);
    if (!categoryId) {
      console.warn(
        `⚠️  Category "${item.category}" not found, skipping "${item.title}"`,
      );
      continue;
    }

    const existing = existingByTitle.get(item.title);
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          categoryId,
        },
      });
      updatedCount++;
    } else {
      await prisma.menuItem.create({
        data: {
          title: item.title,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          categoryId,
        },
      });
      createdCount++;
    }
  }

  // Clean up items that used to be seeded but no longer are (e.g. the seed
  // source array changed) — but only the ones safe to remove.
  const staleItems = existingItems.filter((i) => !seededTitles.has(i.title));
  let deletedCount = 0;
  let skippedCount = 0;
  for (const stale of staleItems) {
    if (stale._count.orderItems > 0) {
      skippedCount++;
      continue;
    }
    await prisma.menuItem.delete({ where: { id: stale.id } });
    deletedCount++;
  }

  console.log(
    `✅ MenuItem rows: ${createdCount} created, ${updatedCount} updated, ${deletedCount} removed` +
      (skippedCount > 0
        ? `, ${skippedCount} skipped (referenced by real orders)`
        : ""),
  );

  // 3) Create all RestaurantTable rows (T-1..T-10, matching the earlier
  //    hardcoded UI). T-4 and T-9 are 2-seaters; the rest are 4-seaters.
  const tableLabels = Array.from({ length: 10 }, (_, i) => `T-${i + 1}`);
  const capacityOverrides: Record<string, number> = {
    "T-4": 2,
    "T-9": 2,
  };

  for (const label of tableLabels) {
    const capacity = capacityOverrides[label] ?? 4;
    await prisma.restaurantTable.upsert({
      where: { label },
      // `update` runs even if the table already exists, so re-running this
      // seed also fixes capacity on tables created by an earlier seed run.
      update: { capacity },
      create: { label, capacity },
    });
  }
  console.log(`✅ ${tableLabels.length} RestaurantTable rows created/updated`);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });