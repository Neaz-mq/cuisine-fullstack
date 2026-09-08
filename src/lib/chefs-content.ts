/**
 * src/lib/chefs-content.ts
 *
 * "Our Chefs" পাতার সব ডেটা — নাম, ছবি, সংখ্যা, লেখা — এক জায়গায়।
 *
 * ⚠️ `lib/landing-content.ts`-এর হুবহু একই কারণে আলাদা: **পরে এগুলো
 * backend থেকে আসবে**। component-গুলো ইতিমধ্যেই prop হিসেবে ডেটা নেয়,
 * আর এখানকার ধ্রুবকগুলো কেবল ডিফল্ট। schema.prisma-য় একটা `Chef`
 * model যোগ করে page.tsx-এ `<MeetTheExperts chefs={await getChefs()} />`
 * লিখলেই কাজ শেষ — নিচের `Chef` type-টা ঠিক সেই আকারেই লেখা।
 *
 * ── ছবিগুলো নিয়ে ──────────────────────────────────────────────────
 *
 * সবগুলো আপনার নিজের Cloudinary (`dxohwanal`) থেকে, আর সবগুলো এই
 * মুহূর্তে সাইটের অন্য কোথাও না কোথাও চলছে। অর্থাৎ লোড হবেই, আর
 * `next.config.ts` ছুঁতে হবে না — ওই host আগে থেকেই `remotePatterns`-এ
 * অনুমোদিত, তাই `<img>`-এর বদলে `next/image` ব্যবহার করা গেল।
 *
 * ⚠️ `JOURNEY_IMAGE` আর `WHY_US_IMAGE` দুটো **আন্দাজে বাছা**। Figma-তে
 * ওখানে রান্নাঘরে শেফদের ছবি আছে, কিন্তু আপনার Cloudinary-তে ঠিক ওই
 * দুটো ছবি আছে কিনা আমি এখান থেকে দেখতে পাই না — বাইরের সাইটে যাওয়া
 * যায় না। তাই যেগুলো নিশ্চিতভাবে আছে সেগুলোই বসানো হলো। মানানসই না
 * লাগলে শুধু এই দুটো URL বদলে দিন, component-এ কিছু করতে হবে না।
 */

export type Chef = {
  id: string;
  /** "Executive Chef", "Master Chef" — কার্ডে নামের উপরে ছোট করে। */
  role: string;
  name: string;
  /** "French Cuisine", "Desserts" — কার্ডের প্রথম ট্যাগ। */
  specialty: string;
  /** দ্বিতীয় ট্যাগে "12 years Exp" হয়ে বসে। */
  yearsExperience: number;
  image: string;
};

export const CHEFS: Chef[] = [
  {
    id: "antoine-rousseau",
    role: "Executive Chef",
    name: "Antoine Rousseau",
    specialty: "French Cuisine",
    yearsExperience: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752057824/chef1_aauap9.webp",
  },
  {
    id: "elena-marchetti",
    role: "Master Chef",
    name: "Elena Marchetti",
    specialty: "Desserts",
    yearsExperience: 9,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752058500/chef2_ivfy0a.webp",
  },
  {
    id: "julien-moreau",
    role: "Chef de Cuisine",
    name: "Julien Moreau",
    specialty: "BBQ & Grill",
    yearsExperience: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752058752/chef3_xhva7c.webp",
  },
  {
    id: "olivier-laurent",
    role: "Kitchen Executive",
    name: "Olivier Laurent",
    specialty: "Rice & Biryani",
    yearsExperience: 7,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752059008/chef4_pgbdux.webp",
  },
  {
    id: "gabriel-dupont",
    role: "Culinary Director",
    name: "Gabriel Dupont",
    specialty: "Wood-Fired Pizza",
    yearsExperience: 8,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752061029/chef5_w0l3nb.webp",
  },
  {
    id: "louis-bernard",
    role: "Culinary Expert",
    name: "Louis Bernard",
    specialty: "Beverages",
    yearsExperience: 4,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752061398/chef6_aqp9rp.webp",
  },
];

// ── Hero ─────────────────────────────────────────────────────────────

export const CHEFS_HERO = {
  badge: "About Us",
  title: "Our Story of Passion, Tradition, and Unforgettable Flavors",
  description:
    "Cuisine started with one simple idea — that a home-cooked meal, made with real ingredients and real care, brings people closer together",
};

// ── Our Journey ──────────────────────────────────────────────────────

export const JOURNEY_IMAGE =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752045017/banner1_p7xkxk.webp";

export const JOURNEY = {
  badge: "Our Journey",
  title: "From a Small Kitchen to Your Doorstep",
  /**
   * ⚠️ দুটো আলাদা অনুচ্ছেদ, একটা লম্বা string নয়।
   *
   * Figma-তে মাঝখানে একটা ফাঁক আছে, আর সেটা `\n` দিয়ে আসে না —
   * HTML সাদা-জায়গা গুঁড়িয়ে দেয়। array রাখলে component প্রতিটাকে
   * নিজের <p>-তে বসাতে পারে।
   */
  paragraphs: [
    "What began as a tiny kitchen in Paris, run by a handful of chefs who refused to compromise on freshness, has grown into a restaurant guests return to again and again. We still cook the same way we did on day one — fresh ingredients, honest recipes, and a genuine love for feeding people well.",
    "Today, our kitchen brings together chefs from different culinary backgrounds, all united by the same goal: every plate that leaves our kitchen should feel like it was made just for you.",
  ],
  /** ছবির উপরে বসা সাদা ছোট কার্ডটা। */
  since: { value: "2016", label: "Since" },
};

export type JourneyStat = { value: string; label: string };

export const JOURNEY_STATS: JourneyStat[] = [
  { value: "8+", label: "Years Serving Guests" },
  { value: "50K+", label: "Happy Customers" },
  { value: "40+", label: "Signature Recipes" },
  { value: "98%", label: "Guest Satisfaction" },
];

// ── Meet the Experts ─────────────────────────────────────────────────

export const EXPERTS_HEADING = "Meet the Experts Behind Every Dish";

// ── Why Guests Choose Us ─────────────────────────────────────────────

export const WHY_US_IMAGE =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752051031/buffet1_ek10ch.webp";

export type WhyUsCard = { title: string; description: string };

export const WHY_US = {
  badge: "Trusted by Food Lovers",
  title: "Why Guests Choose Us",
  description:
    "From fresh ingredients and authentic recipes to warm hospitality, every detail is crafted to deliver an exceptional dining experience you'll remember.",
  imageBadge: "World famous chefs",
  cards: [
    {
      title: "Outstanding Customer Service",
      description:
        "Friendly, attentive staff dedicated to making every visit comfortable and memorable.",
    },
    {
      title: "Authentic Recipes",
      description:
        "Traditional recipes prepared with premium ingredients and rich, authentic flavors.",
    },
    {
      title: "Fresh Ingredients",
      description:
        "We source fresh, locally selected ingredients daily to ensure quality in every dish.",
    },
    {
      title: "Cozy Ambiance",
      description: "Enjoy a warm, inviting atmosphere that's perfect for family meals.",
    },
  ] satisfies WhyUsCard[],
};

// ── Closing CTA ──────────────────────────────────────────────────────

export const CHEFS_CTA = {
  title: "Looking for Something Specific That's Fresh and Delicious?",
  description:
    "Explore a wide selection of freshly prepared dishes made with quality ingredients and unforgettable flavors.",
  buttonLabel: "View Full Menu",
  href: "/menu",
};
