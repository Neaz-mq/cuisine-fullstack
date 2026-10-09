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

export type HeroNutrient = {
  label: string;
  value: string;
  /** Figma-তে চারটে ঘরের চারটে আলাদা রঙ (Inner Card)। */
  tint: string;
};

export type HeroDish = {
  id: string;
  name: string;
  image: string;
  /**
   * এই খাবারের নিজের চারটে পুষ্টি-ঘর (Energy · Carbs · Fats · Protein)।
   * সারিটা ঘোরার সময় মাঝের বড় কার্ডে যে খাবার আসে, ঘরগুলো তারই
   * সংখ্যা দেখায়। না দিলে `Hero`-র `nutrients` prop (ডিফল্ট:
   * `HERO_NUTRIENTS`) বসে — তাই পুরনো ব্যবহার ভাঙে না।
   */
  nutrients?: HeroNutrient[];
};

/**
 * চারটে ঘরের রঙ — Figma-র Inner Card। সব খাবারে একই, তাই একবারই লেখা।
 */
const NUTRIENT_TINTS = {
  energy: "#EDF7E8",
  carbs: "#F9F6F3",
  fats: "#F6F6E8",
  protein: "#E8F0F6",
} as const;

/**
 * চারটে সংখ্যা থেকে চারটে ঘর বানায় — রঙ, লেবেল আর একক (Kcal / gm)
 * এক জায়গায় থাকে, তাই প্রতিটা খাবারে শুধু সংখ্যা লিখলেই হয়।
 */
function heroNutrients(
  kcal: number,
  carbs: number,
  fats: number,
  protein: number,
): HeroNutrient[] {
  return [
    { label: "Energy", value: `${kcal} Kcal`, tint: NUTRIENT_TINTS.energy },
    { label: "Carbs", value: `${carbs} gm`, tint: NUTRIENT_TINTS.carbs },
    { label: "Fats", value: `${fats} gm`, tint: NUTRIENT_TINTS.fats },
    { label: "Protein", value: `${protein} gm`, tint: NUTRIENT_TINTS.protein },
  ];
}

/**
 * Hero-র ছবির সারি — মাঝেরটা বড় (Figma Frame 2147236011, 645×399),
 * দুপাশে ছোট হতে হতে যায় (264×352, তারপর 236×313)।
 *
 * ⚠️ ক্রমটা গুরুত্বপূর্ণ: `Hero` ধরে নেয় **মাঝেরটাই** নায়ক, অর্থাৎ
 * তালিকার তৃতীয় জিনিসটা। পাঁচটার কম দিলে ও নিজেই সামলে নেয়, কিন্তু
 * পাঁচটাই দিলে Figma-র বিন্যাসটা হুবহু মেলে।
 *
 * ⚠️ পুষ্টির সংখ্যাগুলো **একটা সাধারণ পরিবেশনের আনুমানিক মান** — ল্যাবে
 * মাপা নয়। প্রতিটার ক্যালরি = ৪×কার্ব + ৪×প্রোটিন + ৯×চর্বি, মোটামুটি
 * মেলানো (আগের 459 Kcal · 36 · 44 · 55 পরস্পরের সাথে মিলত না)। নিজের
 * রান্নাঘরের আসল মাপ জানা থাকলে নিচের সংখ্যা বদলে দিন।
 */
export const HERO_DISHES: HeroDish[] = [
  {
    id: "french-fries",
    name: "French Fries",
    image:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1791454501/French_fry_zkotbt.webp",
    // মাঝারি এক বাটি।
    nutrients: heroNutrients(380, 48, 19, 5),
  },
  {
    id: "coffee",
    name: "Cappuccino Coffee",
    image:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1791454789/capacino_coffee_ajp0e8.webp",
    // এক কাপ (প্রায় ৩৫০ ml), পুরো দুধে।
    nutrients: heroNutrients(150, 12, 8, 8),
  },
  {
    id: "pizza",
    name: "Classic Pizza",
    image:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1791453589/Pizza_rtajjl.webp",
    // দুই টুকরো।
    nutrients: heroNutrients(470, 56, 18, 22),
  },
  {
    id: "burger",
    name: "Chicken Burger",
    image:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1791453819/Burger_ewimpe.webp",
    // একটা পুরো burger, cheese সহ।
    nutrients: heroNutrients(540, 42, 28, 30),
  },
  {
    // ⚠️ আগে এখানে "Family Feast" (signature3) ছিল — কিন্তু ওটা
    // টেবিলে বসা মানুষের ছবি, খাবারের নয়। সারিটা ঘোরে বলে ওই ছবিটা
    // পালা করে মাঝের বড় ঘরে এসে বসত, আর তখন পুষ্টির ঘরগুলো
    // (459 Kcal · 36 gm …) মানুষের ছবির উপরে ভাসত — অর্থহীন।
    // পাঁচটাই এখন প্লেটে সাজানো খাবার, Figma-র মতো।
    id: "chicken-fry",
    name: "Chicken Fry",
    image:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1791454192/Chicken_Fry_hnvlnb.webp",
    // চার টুকরো।
    nutrients: heroNutrients(380, 12, 22, 34),
  },
];

/**
 * ডিফল্ট চারটে ঘর — শুধু তখন কাজে লাগে যখন কোনো খাবারে নিজের
 * `nutrients` দেওয়া নেই (যেমন পরে backend থেকে এমন খাবার এলো যার
 * পুষ্টি-তথ্য নেই)। মানগুলো আগের মতোই রাখা।
 *
 * ⚠️ এই comment-এর আগের সংস্করণে লেখা ছিল `MenuItem`-এ পুষ্টির কোনো
 * মাঠ নেই — সেটা এখন সত্যি নয়: `calories`, `fatGrams`, `proteinGrams`,
 * `carbGrams` কলামগুলো schema-তে আছে (optional)। তাই পরের ধাপ হলো
 * খাবারগুলোকে মেনুর পদের সাথে মেলানো, যাতে এই সংখ্যাগুলো আসে
 * সরাসরি database থেকে — লেখা থেকে নয়।
 */
export const HERO_NUTRIENTS: HeroNutrient[] = heroNutrients(459, 36, 44, 55);

export type DeliveryBrand = {
  name: string;
  /** ব্র্যান্ডের নিজের রঙ — logo না থাকলে নামটাই সেই রঙে লেখা হয়। */
  color: string;
  /** কয়েকটা ব্র্যান্ড wordmark-এ italic (Wolt), কয়েকটা নয়। */
  italic?: boolean;
  /**
   * Figma-র মাপ (px, 1440px পর্দায়) — প্রতিটা logo-র নিজের বাক্স:
   * foodpanda 160×35 · foodi 88×35 · deliveroo 119×40 · swiggy 136×40 ·
   * Wolt 103×35 · talabat 162×35। logo এই বাক্স ভরে বসে।
   */
  width: number;
  height: number;
  /**
   * আসল logo-র URL (আপনার Cloudinary)। থাকলে `BrandStrip` লেখার বদলে
   * ছবি বসায়; না থাকলে `name` ব্র্যান্ড-রঙে লেখা থাকে। অর্থাৎ একটা
   * একটা করে logo পেলেই এখানে `logo:` বসালে হয় — বাকিগুলো নষ্ট হয় না।
   *
   * ⚠️ ছবির চারপাশে ফাঁকা (transparent) জায়গা থাকলে logo বাক্সে ছোট
   * দেখায়। Cloudinary-র URL-এ `/upload/` -এর ঠিক পরে `e_trim/` বসালে
   * ফাঁকাটুকু কেটে যায় — foodpanda-তে তাই করা আছে।
   */
  logo?: string;
};

/**
 * "Trusted Equipment From Industry Leaders" সারি।
 *
 * ⚠️ আসল logo-গুলো (foodpanda, foodi, deliveroo, swiggy, Wolt, talabat)
 * বসানো হয়নি, ইচ্ছাকৃতভাবে — ওগুলো অন্য কোম্পানির নিবন্ধিত ট্রেডমার্ক,
 * আর আমার কাছে ফাইলও নেই। এলোমেলো জায়গা থেকে logo টেনে আনলে সেটা
 * আইনি ঝুঁকি, আর ভুল সংস্করণ বসার সম্ভাবনাও বেশি।
 *
 * তাই যেগুলোর logo আপনি Cloudinary-তে তুলেছেন (এখন: foodpanda)
 * সেগুলো `logo:` দিয়ে ছবি হিসেবে বসে; বাকিগুলো আপাতত নিজের
 * ব্র্যান্ড-রঙে লেখা। নতুন logo পেলে শুধু ওই ব্র্যান্ডের সারিতে
 * `logo: "https://…"` যোগ করুন — component ছুঁতে হবে না।
 */
export const DELIVERY_BRANDS: DeliveryBrand[] = [
  {
    name: "foodpanda",
    color: "#D70F64",
    width: 160,
    height: 35,
    // e_trim: ছবির চারপাশের ফাঁকা অংশ কেটে ফেলে, তাই logo পুরো বাক্স ভরে।
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791457309/Foodpanda_d9lgmf.webp",
  },
  {
    name: "foodi",
    color: "#E23744",
    width: 88,
    height: 35,
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791457742/foodi_kikkpe.webp",
  },
  {
    name: "deliveroo",
    color: "#00CCBC",
    width: 119,
    height: 40,
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791457937/deliverro_cqpuny.webp",
  },
  {
    name: "swiggy",
    color: "#FC8019",
    width: 136,
    height: 40,
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791458153/swiggy_vfl4ku.webp",
  },
  {
    name: "Wolt",
    color: "#00C2E8",
    italic: true,
    width: 103,
    height: 35,
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791458319/wolt_mkpt9u.webp",
  },
  {
    name: "talabat",
    color: "#FF5A00",
    width: 162,
    height: 35,
    logo: "https://res.cloudinary.com/dzi3u164c/image/upload/e_trim/v1791458510/talabat_poc6ml.webp",
  },
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
 * Gift card ফিচার সরিয়ে দেওয়া হয়েছে (offer আর coupon-ই যথেষ্ট), তাই
 * পুরনো "Gift Cards" লিঙ্কটাও নেই।
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "Home", path: "/" },
  { name: "Menu", path: "/menu" },
  { name: "Our Chefs", path: "/chefs" },
  // /reservation — /dine-in is QR-code table ordering, not booking.
  { name: "Reservation", path: "/reservation" },
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
    // "Cozy atmosphere" → book a table to enjoy it (/dine-in needs a QR code).
    href: "/reservation",
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
  /** DB-র MenuItem.id — React key আর লিংকের জন্য। */
  id: string;
  name: string;
  /** অনুমোদিত review না থাকলে null — তখন তারা দেখানো হয় না। */
  rating: string | null;
  /** সময় · ক্যালরি · চর্বি · প্রোটিন — যেগুলোর মান DB-তে আছে কেবল সেগুলো। */
  chips: string[];
  description: string;
  /** ছবি না থাকলে null — তখন আইকন বসে। */
  image: string | null;
  href: string;
};

/**
 * ⚠️ আগে এখানে হাতে লেখা `SIGNATURE_DISHES` ছিল (Chic Burger, Beef Pizza,
 * Spicy Hotdog) — নাম আর ছবি মিলত না, আর মেনুতে ওই পদ নাও থাকতে পারত।
 * এখন কার্ডগুলো আসে `lib/signature-dishes.ts` থেকে, সরাসরি database থেকে।
 */

/** নিচের চওড়া পটির ছবি (Frame 2147236019, radius 30)। */
export const SIGNATURE_BANNER = {
  title: "Deep Blue Delights",
  image:
    "https://res.cloudinary.com/dzi3u164c/image/upload/v1791470110/deep_blue_qdyadv.webp",
};

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
 * মুখের ছবি দুটো এখন আসল খদ্দেরের (Cloudinary, dzi3u164c account)।
 * নাম/ছবি বদলাতে চাইলে শুধু এখানেই বদলাবেন।
 */
export const GUEST_STORIES: GuestStory[] = [
  {
    stat: "98%",
    statLabel: "Guest Satisfaction",
    quote:
      "The seasonal menu completely redefined what fresh dining means to us. Every single dish feels deeply intentional, bursting with authentic flavors that keep us coming back every week.",
    name: "Smith",
    role: "Regular Guest",
    avatar:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1775280183/4_gxrtp2.webp",
  },
  {
    stat: "2x",
    statLabel: "Faster Delivery",
    quote:
      "Getting my Friday night gourmet burgers used to take an hour of waiting. Now, I access piping hot, restaurant-quality food in half the time.",
    name: "Alex Hales",
    role: "Weekend Diner",
    avatar:
      "https://res.cloudinary.com/dzi3u164c/image/upload/v1739354768/men2_pleix9.jpg",
  },
];

/**
 * মাঝের ভিডিও (Frame 2147235978, 488×479, radius 20)।
 *
 * `poster` — ক্লিকের আগে যে thumbnail দেখায়। `src` — আসল mp4।
 * GuestsSection `src` সরাসরি চালায় (কোনো URL transformation ছাড়া)।
 */
export const GUEST_VIDEO = {
  src: "https://res.cloudinary.com/dzi3u164c/video/upload/v1791556207/ORO_Food_Wine_Hamburger_reel_Dreamer_Studio_uyljbh.mp4",
  poster:
    "https://res.cloudinary.com/dzi3u164c/image/upload/v1791558320/Thumb_kkjve4.webp",
  alt: "Guests enjoying a gourmet burger and wine at our restaurant",
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