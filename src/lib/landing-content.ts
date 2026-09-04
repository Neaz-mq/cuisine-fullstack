/**
 * src/lib/landing-content.ts
 *
 * Landing পাতার সব "ডেটা" — ছবি, লেখা, সংখ্যা — এক জায়গায়।
 *
 * ⚠️ এই ফাইলটা আলাদা রাখার একটাই কারণ: **পরে এগুলো backend থেকে
 * আসবে**। তখন component-গুলো ছুঁতে হবে না — ওরা ইতিমধ্যেই prop হিসেবে
 * ডেটা নেয়, আর এখানকার ধ্রুবকগুলো কেবল ডিফল্ট। page.tsx-এ
 * `<Hero dishes={await getHeroDishes()} />` লিখে দিলেই কাজ শেষ।
 *
 * অর্থাৎ আজকের কাজটা "dummy বসিয়ে দেওয়া" নয়, **আকারটা ঠিক করে
 * রাখা** — ডেটার ছাঁচ যা হবে, সেটাই এখন থেকে চলছে।
 *
 * ── ছবিগুলো নিয়ে ──────────────────────────────────────────────────
 *
 * ⚠️ আগে এখানে Unsplash-এর লিঙ্ক ছিল আর **একটাও লোড হয়নি** — ভাঙা
 * আইকন আর alt-লেখা দেখা যাচ্ছিল। আমি ID-গুলো যাচাই করতে পারিনি,
 * কারণ এই পরিবেশ থেকে বাইরের সাইটে যাওয়া যায় না; অর্থাৎ ওগুলো
 * আন্দাজে বসানো হয়েছিল, আর আন্দাজটা ভুল ছিল।
 *
 * এখন ছবিগুলো **আপনার নিজের Cloudinary অ্যাকাউন্ট থেকে** — ঠিক যেগুলো
 * `Buffet.tsx` আর `Signature.tsx`-এ এই মুহূর্তে চলছে। অর্থাৎ:
 *
 *   • লোড হবেই — ওগুলো এখনই সাইটে দেখা যাচ্ছে
 *   • `next.config.ts` ছুঁতে হবে না — ওই host আগে থেকেই অনুমোদিত,
 *     তাই `<img>`-এর বদলে `next/image`-ও ব্যবহার করা গেল
 *   • খাবারগুলো আপনারই — Grilled Lamb Chop, Pan-Seared Steak ইত্যাদি
 *
 * নিজের নতুন ছবি বসাতে চাইলে Cloudinary-তে তুলে শুধু নিচের URL
 * বদলে দিন; component-এ কিছু করতে হবে না।
 */

export type HeroDish = {
  id: string;
  name: string;
  image: string;
};

export type HeroNutrient = {
  label: string;
  value: string;
  /** Figma-তে চারটে ঘরের চারটে আলাদা রঙ (Inner Card)। */
  tint: string;
};

/**
 * Hero-র ছবির সারি — মাঝেরটা বড় (Figma Frame 2147236011, 645×399),
 * দুপাশে ছোট হতে হতে যায় (264×352, তারপর 236×313)।
 *
 * ⚠️ ক্রমটা গুরুত্বপূর্ণ: `Hero` ধরে নেয় **মাঝেরটাই** নায়ক, অর্থাৎ
 * তালিকার তৃতীয় জিনিসটা। পাঁচটার কম দিলে ও নিজেই সামলে নেয়, কিন্তু
 * পাঁচটাই দিলে Figma-র বিন্যাসটা হুবহু মেলে।
 */
export const HERO_DISHES: HeroDish[] = [
  {
    id: "lamb",
    name: "Grilled lamb chop",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051031/buffet1_ek10ch.webp",
  },
  {
    id: "sandwich",
    name: "Special sandwich",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051554/buffet4_cwwunl.webp",
  },
  {
    id: "combo",
    name: "Classic combo platter",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052166/signature1_gyjebg.webp",
  },
  {
    id: "steak",
    name: "Pan-seared steak",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051401/buffet3_brkpjm.webp",
  },
  {
    // ⚠️ আগে এখানে "Family Feast" (signature3) ছিল — কিন্তু ওটা
    // টেবিলে বসা মানুষের ছবি, খাবারের নয়। সারিটা ঘোরে বলে ওই ছবিটা
    // পালা করে মাঝের বড় ঘরে এসে বসত, আর তখন পুষ্টির ঘরগুলো
    // (459 Kcal · 36 gm …) মানুষের ছবির উপরে ভাসত — অর্থহীন।
    // পাঁচটাই এখন প্লেটে সাজানো খাবার, Figma-র মতো।
    id: "steak-super",
    name: "Grilled super steak",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051223/buffet2_lv0gz5.webp",
  },
];

/**
 * মাঝের ছবির উপরে ভাসা চারটে পুষ্টি-ঘর।
 *
 * ⚠️ সংখ্যাগুলো আপাতত স্থির, আর সেটা লুকোনোর কিছু নেই: `MenuItem`-এ
 * পুষ্টির কোনো মাঠই নেই (আছে শুধু title, description, price, imageUrl,
 * isAvailable)। সত্যিকারের সংখ্যা দেখাতে হলে চারটে কলাম + একটা
 * migration লাগবে, আর form-এ ঘরগুলো। বললেই করে দেব।
 *
 * ততদিন এগুলো marketing-এর লেখা, ডেটা নয় — তাই এখানে, `lib`-এ,
 * component-এর ভেতরে ছড়িয়ে নয়।
 */
export const HERO_NUTRIENTS: HeroNutrient[] = [
  { label: "Energy", value: "459 Kcal", tint: "#EDF7E8" },
  { label: "Carbs", value: "36 gm", tint: "#F9F6F3" },
  { label: "Fats", value: "44 gm", tint: "#F6F6E8" },
  { label: "Protein", value: "55 gm", tint: "#E8F0F6" },
];

export type DeliveryBrand = {
  name: string;
  /** ব্র্যান্ডের নিজের রঙ — logo না থাকায় নামটাই সেই রঙে লেখা হয়। */
  color: string;
  /** কয়েকটা ব্র্যান্ড wordmark-এ italic (Wolt), কয়েকটা নয়। */
  italic?: boolean;
};

/**
 * "Trusted Equipment From Industry Leaders" সারি।
 *
 * ⚠️ আসল logo-গুলো (foodpanda, foodi, deliveroo, swiggy, Wolt, talabat)
 * বসানো হয়নি, ইচ্ছাকৃতভাবে — ওগুলো অন্য কোম্পানির নিবন্ধিত ট্রেডমার্ক,
 * আর আমার কাছে ফাইলও নেই। এলোমেলো জায়গা থেকে logo টেনে আনলে সেটা
 * আইনি ঝুঁকি, আর ভুল সংস্করণ বসার সম্ভাবনাও বেশি।
 *
 * তাই আপাতত প্রতিটা নাম তার নিজের ব্র্যান্ড-রঙে লেখা — জায়গা,
 * ব্যবধান আর মাপ ঠিক Figma-র, শুধু ছবির বদলে লেখা। SVG পেলে
 * `BrandStrip`-এ `<span>`-টা `<img>` করে দিলেই হবে।
 */
export const DELIVERY_BRANDS: DeliveryBrand[] = [
  { name: "foodpanda", color: "#D70F64" },
  { name: "foodi", color: "#E23744" },
  { name: "deliveroo", color: "#00CCBC" },
  { name: "swiggy", color: "#FC8019" },
  { name: "Wolt", color: "#00C2E8", italic: true },
  { name: "talabat", color: "#FF5A00" },
];

/* ── TopBar আর Navbar-এর লেখা ──────────────────────────────────────── */

/**
 * ⚠️ ঠিকানাটা এখানে, settings-এ নয় — কারণ `RestaurantSettings`-এ
 * ঠিকানার কোনো মাঠই নেই (আছে `timezone`, `kitchenOpenHour`,
 * `kitchenCloseHour`, `currency`, বকশিশের সেটিং)। খোলার সময় দুটো
 * settings থেকেই আসে, কিন্তু ঠিকানা আপাতত লেখা।
 *
 * পরে `address` কলাম যোগ করলে `/api/settings`-এ মাঠটা পাঠালেই
 * `SiteTopBar` ওটা তুলে নেবে — component-এ prop আছে, ডিফল্ট এখানে।
 */
export const RESTAURANT_ADDRESS = "2454 Onk Drive, Paris, France";

export type NavItem = { name: string; path: string };

/**
 * Figma-র navbar: Home · Menu · Our Chefs · Reservation।
 *
 * ⚠️ পুরনো খাড়া rail-এ ছিল Home · Menu · Our Chefs · **Gift Cards**।
 * Figma-তে "Gift Cards"-এর বদলে "Reservation" — কিন্তু `/gift-cards`
 * পাতাটা সত্যিই আছে, তাই লিঙ্কটা হারিয়ে ফেলা ঠিক হতো না। দুটোই
 * রাখা হলো, আর Figma-র ক্রমটাই মানা হলো।
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "Home", path: "/" },
  { name: "Menu", path: "/menu" },
  { name: "Our Chefs", path: "/chefs" },
  { name: "Reservation", path: "/dine-in" },
  { name: "Gift Cards", path: "/gift-cards" },
];

/* ── "Our Services" section ───────────────────────────────────────── */

export type ServiceItem = {
  /** Figma-তে কার্ডের মাথায় "Services 01" — ক্রমটা নকশার অংশ। */
  index: string;
  title: string;
  description: string;
  href: string;
};

/**
 * ছটা কার্ড, দুই সারিতে তিনটে করে (Figma Frame 2147236012)।
 *
 * ⚠️ লেখাগুলো screenshot থেকে তুলে নেওয়া, CSS export থেকে নয় — export-এ
 * প্রতিটা কার্ডের লেখা একই নমুনা ("Only the Freshest Ingredients" ছটা
 * জায়গায়), কারণ designer component-টা copy করে বসিয়েছেন আর শুধু
 * ছবিতে আসল লেখা বসিয়েছেন।
 *
 * ⚠️ `href` — Figma-তে "Explore More" pill-টা কোথায় যায় বলা নেই।
 * ছটাই আপাতত `/menu`-তে; সত্যিকারের গন্তব্য জানা গেলে এখানেই
 * বদলাবেন, component ছুঁতে হবে না।
 */
export const SERVICES: ServiceItem[] = [
  {
    index: "01",
    title: "Only the Freshest Ingredients",
    description:
      "Carefully sourced ingredients for exceptional taste, freshness, and lasting quality.",
    href: "/menu",
  },
  {
    index: "02",
    title: "Unique and Delicious Menu",
    description:
      "Our menu is carefully crafted by expert chefs using only the freshest ingredients.",
    href: "/menu",
  },
  {
    index: "03",
    title: "Outstanding Customer Service",
    description:
      "Our staff is dedicated to providing warm and attentive service with genuine hospitality.",
    href: "/chefs",
  },
  {
    index: "04",
    title: "Cozy and Inviting Atmosphere",
    description:
      "We've designed our restaurant to be comfortable, stylish, and welcoming for every guest.",
    href: "/dine-in",
  },
  {
    index: "05",
    title: "Commitment to Cleanliness",
    description:
      "We adhere to the highest standards of hygiene and food safety at every step.",
    href: "/menu",
  },
  {
    index: "06",
    title: "Affordable Prices with Great Value",
    description:
      "We believe that exceptional food should bring people together every single day.",
    href: "/menu",
  },
];

/* ── "Our Signature" section ──────────────────────────────────────── */

export type SignatureDish = {
  name: string;
  rating: string;
  /** Figma-র চারটে ছোট chip: সময় · ক্যালরি · চর্বি · প্রোটিন। */
  chips: string[];
  description: string;
  image: string;
  href: string;
};

/**
 * তিনটে signature পদ (Figma Frame 2147235270)।
 *
 * ⚠️ ছবিগুলো আবারও আপনার নিজের Cloudinary থেকে — Buffet/Signature-এ
 * এগুলোই চলছে, তাই লোড হওয়া নিশ্চিত আর `next.config.ts` ছুঁতে হয় না।
 *
 * ⚠️ chip-এর সংখ্যাগুলো (৩০ min · ৬১৫ kcal …) স্থির — `MenuItem`-এ
 * রান্নার সময় বা পুষ্টির কোনো মাঠ নেই। Hero-র পুষ্টি-ঘরের মতোই
 * এগুলো আপাতত marketing-এর লেখা; কলাম যোগ করলে এখান থেকেই সরাসরি
 * DB-তে যাবে।
 */
export const SIGNATURE_DISHES: SignatureDish[] = [
  {
    name: "Chic Burger",
    rating: "4.7",
    chips: ["30 min", "615 kcal", "65 Fats", "45 Protein"],
    description:
      "A juicy chicken patty topped with fresh lettuce, melted cheese, and our signature sauce.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051554/buffet4_cwwunl.webp",
    href: "/menu",
  },
  {
    name: "Beef Pizza",
    rating: "4.6",
    chips: ["25 min", "540 kcal", "34 Fats", "76 Protein"],
    description:
      "Loaded with seasoned beef, melted mozzarella, and fresh toppings on a perfectly baked crust.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052166/signature1_gyjebg.webp",
    href: "/menu",
  },
  {
    name: "Spicy Hotdog",
    rating: "4.9",
    chips: ["20 min", "545 kcal", "56 Fats", "76 Protein"],
    description:
      "Packed with smoky flavor, spicy seasoning, and crisp vegetables for a delicious Irish in every bite.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752051401/buffet3_brkpjm.webp",
    href: "/menu",
  },
];

/** নিচের চওড়া পটির ছবি (Frame 2147236019, radius 30)। */
export const SIGNATURE_BANNER = {
  title: "Deep Blue Delights",
  image:
    "https://res.cloudinary.com/dxohwanal/image/upload/v1752052450/signature3_td2pb9.webp",
};

/* ── "Combo Deals" section ────────────────────────────────────────── */

export type ComboDeal = {
  name: string;
  rating: string;
  /** ছাড়ের ব্যাজ, ছবির বাঁ-উপরে (Frame 2147235206)। */
  discount: string;
  chips: string[];
  /** কমলা টিক সহ যা যা থাকছে (Frame 2147236027)। */
  includes: string[];
  description: string;
  price: string;
  /** কাটা দাম — ছাড়ের আগেরটা। */
  wasPrice: string;
  image: string;
  href: string;
};

/**
 * তিনটে combo (Figma Frame 2147235270)।
 *
 * ⚠️ দামগুলো এখানে **লেখা হিসেবে**, সংখ্যা হিসেবে নয় — আর সেটা
 * ইচ্ছাকৃত। এগুলো marketing-এর নমুনা; সত্যিকারের দাম এলে সেটা
 * `MenuItem.price` (Decimal) থেকে আসবে আর `formatAmount()` দিয়ে
 * দোকানের চলতি মুদ্রায় সাজবে — Inventory-তে যেমন করা হয়েছে।
 * তাই এখানে `$` চিহ্নটা হার্ডকোড; পরে ওটাই সরাতে হবে।
 */
export const COMBO_DEALS: ComboDeal[] = [
  {
    name: "Classic Combo",
    rating: "4.8",
    discount: "20%",
    chips: ["30 min", "1034 kcal", "80 Fats", "120 Protein"],
    includes: ["Chicken Burger", "French Fries", "Soft Drinks"],
    description:
      "Succulent spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: "$7.89",
    wasPrice: "$16.99",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052166/signature1_gyjebg.webp",
    href: "/menu",
  },
  {
    name: "Chicken Delight",
    rating: "4.7",
    discount: "20%",
    chips: ["40 min", "1456 kcal", "140 Fats", "250 Protein"],
    includes: ["Crispy Chicken Sandwich", "French Fries", "Soft Drinks"],
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: "$8.99",
    wasPrice: "$16.99",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052270/signature2_wasgom.webp",
    href: "/menu",
  },
  {
    name: "Family Feast",
    rating: "5.0",
    discount: "20%",
    chips: ["60 min", "2435 kcal", "100 Fats", "400 Protein"],
    includes: ["Multiple dishes", "Large portions", "Soft Drinks"],
    description:
      "Succulent spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    price: "$19.89",
    wasPrice: "$16.99",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052450/signature3_td2pb9.webp",
    href: "/menu",
  },
];

/* ── "Our Guests" section ─────────────────────────────────────────── */

export type GuestStory = {
  stat: string;
  statLabel: string;
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

/**
 * দুটো প্রশংসাপত্র, মাঝের ভিডিও-ছবির দুপাশে (Figma Frame 2147235980)।
 *
 * ⚠️ মুখের ছবি দুটো Cloudinary-র `chef*` — প্রজেক্টে ওগুলোই একমাত্র
 * মানুষের ছবি যা নিশ্চিতভাবে লোড হয়। আসল খদ্দেরের ছবি এলে এখানেই
 * বদলাবেন।
 */
export const GUEST_STORIES: GuestStory[] = [
  {
    stat: "98%",
    statLabel: "Guest Satisfaction",
    quote:
      "The seasonal menu completely redefined what fresh dining means to us. Every single dish feels deeply intentional, bursting with authentic flavors that keep us coming back every week.",
    name: "Ridoy Ahmed",
    role: "Regular Guest",
    avatar:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752057824/chef1_aauap9.webp",
  },
  {
    stat: "2x",
    statLabel: "Faster Delivery",
    quote:
      "Getting my Friday night gourmet burgers used to take an hour of waiting. Now, I access piping hot, restaurant-quality food in half the time.",
    name: "Elena Rostova",
    role: "Weekend Diner",
    avatar:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752058500/chef2_ivfy0a.webp",
  },
];

/** মাঝের বড় ছবিটা (Frame 2147235978, 488×479, radius 20)। */
export const GUEST_VIDEO = {
  image:
    "https://res.cloudinary.com/dxohwanal/image/upload/v1752052734/signature4_ec4hsr.webp",
  alt: "Guests sharing a meal together",
};

/* ── "FAQ" section ────────────────────────────────────────────────── */

export type FaqItem = { question: string; answer: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How is the food kept hot and fresh?",
    answer:
      "We use premium thermal bags and optimized delivery routes to lock in kitchen-fresh temperature and flavor.",
  },
  {
    question: "Where do you source ingredients?",
    answer:
      "We work directly with local farms and trusted suppliers, so most produce reaches our kitchen within a day of harvest.",
  },
  {
    question: "Do you accommodate dietary needs?",
    answer:
      "Yes — vegetarian, vegan and gluten-free options are marked on the menu, and our chefs can adjust most dishes on request.",
  },
  {
    question: "Can I pre-order meals in advance?",
    answer:
      "You can schedule an order up to seven days ahead, and we start preparing it so it arrives exactly when you asked for it.",
  },
  {
    question: "What is your delivery time?",
    answer:
      "Most orders arrive within 30 to 45 minutes, depending on distance and how busy the kitchen is.",
  },
];
