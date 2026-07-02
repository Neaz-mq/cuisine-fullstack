/**
 * prisma/seed.ts
 *
 * পুরনো `cuisine` (frontend-only) প্রজেক্টের 7টা component ফাইল থেকে
 * সব menu item একসাথে করে এই seed script বানানো হয়েছে:
 * Items.jsx, Category.jsx, Popular.jsx, Signature.jsx, Weekly.jsx, Feast.jsx, Limited.jsx
 *
 * রান করার আগে: prisma/seed.ts ফাইলে এই কন্টেন্ট সেভ করুন,
 * তারপর নিচের কমান্ড চালান (নিচে ব্যাখ্যা করা আছে)।
 */

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Category list (Items.jsx + Category.jsx থেকে, ডুপ্লিকেট merge করা হয়েছে)
// ---------------------------------------------------------------------------
const categories = [
  "Burgers",
  "Chicken",
  "Pizza",
  "Salad",
  "Appetizer",
  "Drinks",
  "Signature",
  "Mushroom",
  "Coffee",
  "Popular",
  "Weekly Special",
  "Feast",
  "Limited Offer",
];

// ---------------------------------------------------------------------------
// Menu items — সব ফাইল থেকে একসাথে, প্রতিটাতে category ট্যাগ করা আছে
// price সব জায়গায় Float-এ normalize করা ($ চিহ্ন বাদ দিয়ে)
// ---------------------------------------------------------------------------
const menuItems = [
  // ---- Items.jsx: BURGERS ----
  {
    title: "Fresh Burger",
    description:
      "We source only the freshest and highest-quality ingredients to ensure every dish bursts with flavor.",
    price: 300,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Burgers",
  },
  {
    title: "Juicy Burger",
    description:
      "Our signature beef patty, cooked to perfection and served on a toasted bun with fresh veggies.",
    price: 320,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Burgers",
  },
  {
    title: "Spicy BBQ Burger",
    description:
      "A smoky and spicy delight with a zesty BBQ sauce, crispy onions, and melted cheese.",
    price: 310,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Burgers",
  },
  {
    title: "Mushroom Swiss Burger",
    description:
      "Earthy mushrooms and melted Swiss cheese complement our succulent beef patty perfectly.",
    price: 305,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Burgers",
  },

  // ---- Items.jsx: CHICKEN ----
  {
    title: "Crispy Fried Chicken",
    description:
      "Our chicken is fried to golden perfection, crispy on the outside, juicy on the inside, a true delight.",
    price: 250,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Spicy Chicken Wings",
    description:
      "Experience the fiery kick of our spicy chicken wings, perfect for those who love a bit of heat.",
    price: 280,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Grilled Chicken Salad",
    description:
      "Healthy and delicious, our grilled chicken salad is packed with fresh greens and tender chicken.",
    price: 220,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },
  {
    title: "Chicken Nuggets Meal",
    description:
      "A perfect meal for the little ones, tender chicken nuggets with a side of crispy fries.",
    price: 180,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
    category: "Chicken",
  },

  // ---- Items.jsx: PIZZA ----
  {
    title: "Classic Pepperoni Pizza",
    description:
      "A timeless favorite with rich tomato sauce, mozzarella, and savory pepperoni slices.",
    price: 450,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
    category: "Pizza",
  },
  {
    title: "Margherita Delight",
    description:
      "Simple yet perfect, with fresh basil, mozzarella, and a hint of olive oil on a crispy crust.",
    price: 400,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
    category: "Pizza",
  },
  {
    title: "Veggie Supreme Pizza",
    description:
      "Loaded with a colorful array of fresh vegetables, olives, and bell peppers.",
    price: 420,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
    category: "Pizza",
  },
  {
    title: "Chicken BBQ Pizza",
    description:
      "Tangy BBQ sauce, grilled chicken, red onions, and cilantro create a unique flavor.",
    price: 480,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
    category: "Pizza",
  },

  // ---- Items.jsx: SALAD ----
  {
    title: "Garden Fresh Salad",
    description:
      "Crisp, fresh greens with a mix of vibrant vegetables and a light vinaigrette dressing.",
    price: 150,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130270/menu11_yizlj0.webp",
    category: "Salad",
  },
  {
    title: "Caesar Salad Chicken",
    description:
      "Classic Caesar salad with grilled chicken, croutons, and Parmesan cheese.",
    price: 200,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130270/menu11_yizlj0.webp",
    category: "Salad",
  },
  {
    title: "Mediterranean Quinoa Salad",
    description:
      "A hearty and healthy salad with quinoa, olives, feta, and sun-dried tomatoes.",
    price: 230,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130540/menu12_jowol9.webp",
    category: "Salad",
  },
  {
    title: "Cobb Salad Supreme",
    description:
      "A rich Cobb salad with chicken, bacon, avocado, egg, and blue cheese.",
    price: 280,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752130540/menu12_jowol9.webp",
    category: "Salad",
  },

  // ---- Items.jsx: APPETIZER ----
  {
    title: "Crispy French Fries",
    description:
      "Golden, crispy, and perfectly salted french fries, a classic appetizer.",
    price: 80,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Onion Rings Sauce",
    description:
      "Sweet and savory onion rings, deep-fried to perfection, served with a special dipping sauce.",
    price: 100,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Mozzarella Sticks",
    description:
      "Warm, gooey mozzarella sticks coated in crispy breading, served with marinara.",
    price: 120,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },
  {
    title: "Garlic Bread with Cheese",
    description:
      "Toasted garlic bread topped with melted cheese, a perfect companion to any meal.",
    price: 90,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
    category: "Appetizer",
  },

  // ---- Items.jsx: DRINKS ----
  {
    title: "Classic Coca-Cola",
    description:
      "The refreshing taste of Coca-Cola, perfectly chilled to quench your thirst.",
    price: 50,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Freshly Squeezed Orange Juice",
    description:
      "Natural and invigorating, our freshly squeezed orange juice is a burst of citrus flavor.",
    price: 100,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Creamy Vanilla Milkshake",
    description:
      "Indulge in our rich and creamy vanilla milkshake, a sweet treat for any time.",
    price: 90,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },
  {
    title: "Iced Lemon Tea",
    description:
      "Cool down with our refreshing iced lemon tea, perfectly balanced between sweet and tart.",
    price: 60,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
    category: "Drinks",
  },

  // ---- Category.jsx: Signature ----
  {
    title: "Crispy Fried Chicken (Signature)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Crispy Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Crispy Hot Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Fried Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 8,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Normal Fried Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 6,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Average Fried Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 4,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    title: "Thai Fried Chicken",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 2,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },

  // ---- Category.jsx: Mushroom ----
  {
    title: "Mozila Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Donald Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Sticky Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Mehoniz Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Italian Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 9,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Hot Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 6,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    title: "Normal Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 4,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
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

  // ---- Category.jsx: Pizza (merge হবে উপরের Pizza category-র সাথে) ----
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

  // ---- Popular.jsx ----
  {
    title: "Classic Roast Brew",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Popular",
  },
  {
    title: "Cheesy Crust Deluxe",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Popular",
  },
  {
    title: "Classic Roast Special",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Popular",
  },
  {
    title: "Cheesy Crust Superior",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 18,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Popular",
  },

  // ---- Signature.jsx (component নাম একই, কিন্তু আলাদা data — "Set Meals") ----
  {
    title: "Classic Combo",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: 7.89,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052166/signature1_gyjebg.webp",
    category: "Signature",
  },
  {
    title: "Chicken Delight",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: 8.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052270/signature2_wasgom.webp",
    category: "Signature",
  },
  {
    title: "Family Feast",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: 19.89,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052450/signature3_td2pb9.webp",
    category: "Signature",
  },
  {
    title: "Mega Meal",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: 29.99,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052734/signature4_ec4hsr.webp",
    category: "Signature",
  },

  // ---- Weekly.jsx ----
  {
    title: "Crispy Chicken Wings",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752131105/menu14_ic1vqr.webp",
    category: "Weekly Special",
  },
  {
    title: "Santa's Stuffed Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752131180/menu15_b2jpqw.webp",
    category: "Weekly Special",
  },
  {
    title: "Classic Roast Brew (Weekly)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752131250/menu16_kvd8lx.webp",
    category: "Weekly Special",
  },
  {
    title: "Cheesy Crust Deluxe (Weekly)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752131326/menu17_i0xaie.webp",
    category: "Weekly Special",
  },

  // ---- Feast.jsx ----
  {
    title: "Crispy Chicken Wings (Feast)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752126479/offer12_wn37pv.webp",
    category: "Feast",
  },
  {
    title: "Santa's Stuff Mushrooms",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752126715/offer13_jefv2j.webp",
    category: "Feast",
  },
  {
    title: "Classic Roast Brew (Feast)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752127012/offer14_viddzm.webp",
    category: "Feast",
  },
  {
    title: "Cheesy Crust Deluxe (Feast)",
    description:
      "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 18,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752127252/offer15_fc5m1h.webp",
    category: "Feast",
  },

  // ---- Limited.jsx ----
  {
    title: "Main Courses",
    description: "Succulent, space-rubbed lamb chops grilled to...",
    price: 200,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752123186/offer1_xts2ue.webp",
    category: "Limited Offer",
  },
  {
    title: "Salads & Sides",
    description: "Succulent, space-rubbed lamb chops grilled to...",
    price: 165,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752123462/offer2_mqlcmt.webp",
    category: "Limited Offer",
  },
  {
    title: "Dessert Items",
    description: "Succulent, space-rubbed lamb chops grilled to...",
    price: 110,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752123699/offer3_w3cpxv.webp",
    category: "Limited Offer",
  },
  {
    title: "Soft Drinks",
    description: "Succulent, space-rubbed lamb chops grilled to...",
    price: 90,
    imageUrl:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752123936/offer4_wsne9i.webp",
    category: "Limited Offer",
  },
];

async function main() {
  console.log("🌱 Starting seed...");

  // 1) Create all Category rows (upsert — skip if exists, create if not)
  const categoryMap = new Map<string, string>(); // name -> id

  for (const name of categories) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryMap.set(name, category.id);
  }
  console.log(`✅ ${categories.length} Category rows created/confirmed`);

  // 2) Create MenuItem rows — capped at SEED_ITEMS_PER_CATEGORY per category
  //
  // The full source list (menuItems) has 72 items across 13 categories.
  // For local/testing purposes we only need a handful per category, not the
  // whole set — so we take the first N per category here. Bump this number
  // (or seed the full `menuItems` array directly) whenever real menu data
  // is needed.
  //
  // MenuItem has no natural unique key (unlike Category.name or
  // RestaurantTable.label), so upsert isn't possible here. Instead we clear
  // out existing menu items first and recreate them fresh — this seed file
  // is the single source of truth for menu data, so "wipe and reseed" is the
  // correct idempotent behavior. NOTE: this will fail with a foreign-key
  // error once real Orders reference MenuItems (OrderItem.menuItemId) — at
  // that point switch this to an upsert keyed on a new MenuItem.slug field,
  // or only delete items with isAvailable: true that have zero orderItems.
  const SEED_ITEMS_PER_CATEGORY = 3;

  const itemsPerCategoryCount = new Map<string, number>();
  const trimmedMenuItems = menuItems.filter((item) => {
    const usedSoFar = itemsPerCategoryCount.get(item.category) ?? 0;
    if (usedSoFar >= SEED_ITEMS_PER_CATEGORY) return false;
    itemsPerCategoryCount.set(item.category, usedSoFar + 1);
    return true;
  });

  const deleted = await prisma.menuItem.deleteMany({});
  console.log(`🧹 Cleared ${deleted.count} existing MenuItem rows before reseeding`);

  let createdCount = 0;
  for (const item of trimmedMenuItems) {
    const categoryId = categoryMap.get(item.category);
    if (!categoryId) {
      console.warn(
        `⚠️  Category "${item.category}" not found, skipping "${item.title}"`,
      );
      continue;
    }

    await prisma.menuItem.create({
      data: {
        title: item.title,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        categoryId: categoryId,
      },
    });
    createdCount++;
  }

  console.log(`✅ ${createdCount} MenuItem rows created`);

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