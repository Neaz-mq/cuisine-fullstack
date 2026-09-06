import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import MenuHero from "@/components/menu/MenuHero";
import TodaysOffers, { type MenuOffer } from "@/components/menu/TodaysOffers";
import MenuBrowser, { type MenuBrowserCategory } from "@/components/menu/MenuBrowser";
import SignatureSection from "@/components/landing/SignatureSection";
import MenuComboCta from "@/components/menu/MenuComboCta";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse our full menu and order online for delivery or dine-in.",
};

/**
 * ⚠️ প্রতিটা request-এ নতুন করে render, build-এর সময় নয়।
 *
 * এটাই `(main)`-এর প্রথম **প্রকাশ্য** পাতা যেটা server-এ সরাসরি
 * database ছোঁয় (বাকিগুলো হয় স্থির, নয় client থেকে `/api/menu`
 * ডাকে)। Next.js ডিফল্টে এমন পাতা build-এর সময়ই একবার চালিয়ে HTML
 * বানিয়ে রাখতে চায় — আর CI-তে (GitHub Actions) কোনো database নেই,
 * তাই `prisma.restaurantSettings.upsert()` ECONNREFUSED দিয়ে পুরো
 * build ভেঙে দিত।
 *
 * ⚠️ `revalidate` দিয়ে সমাধান হতো না — ওটাতেও build-এর সময় একবার
 * render হয়, কেবল পরে নতুন করে হয়। ভাঙাটা ঠিক ওই প্রথম render-এই।
 *
 * Admin পাতাগুলোয় এই সমস্যা নেই, কারণ ওরা `requireStaff()` → `auth()`
 * → cookie পড়ে, আর cookie পড়া মানেই Next-এর কাছে পাতাটা এমনিতেই
 * dynamic।
 *
 * খরচ: প্রতিটা ভিজিটে কয়েকটা query। মেনু জিনিসটা ছোট, আর দাম বা
 * "পাওয়া যাচ্ছে না" অবস্থাটা বাসি দেখানোর চেয়ে সেটা অনেক সস্তা।
 */
export const dynamic = "force-dynamic";

/**
 * src/app/(main)/menu/page.tsx
 *
 * Figma "Web/Menu" — পাঁচটা অংশ, উপর থেকে নিচে:
 *
 *   1. Hero            #F9F6F3 — "Our Full Menu" pill + বড় শিরোনাম
 *   2. Today's Offers  সাদা — তিনটে রঙিন কুপন-কার্ড
 *   3. Categories      #F9F6F3 — chip + শ্রেণিভিত্তিক Food Card
 *   4. Signature       gradient — হোমপেজের `SignatureSection`
 *   5. Combo CTA       সাদা — শিরোনাম + দুটো বোতাম
 *
 * উপরের কালো পটি, navbar আর Footer `(main)/layout.tsx`-এ — সব পাতায়
 * এক, তাই এখানে নেই।
 *
 * ⚠️ চতুর্থ অংশটা হোমপেজের component-টাই, নতুন করে লেখা হয়নি। Figma-র
 * menu Frame 2147236008 আর home Frame 2147236005 — মাপ, রঙ, কার্ডের
 * গড়ন, এমনকি "Deep Blue Delights" banner পর্যন্ত হুবহু এক। দুটো আলাদা
 * ফাইল রাখলে একটায় বদল করে অন্যটা ভুলে যাওয়া কেবল সময়ের ব্যাপার।
 *
 * ⚠️ পঞ্চম অংশটা কিন্তু `landing/ComboSection` **নয়**, যদিও শিরোনাম
 * প্রায় এক। ওটা তিনটে combo কার্ড সহ আস্ত একটা section, এটা কেবল
 * শিরোনাম + দুটো বোতাম। বিস্তারিত MenuComboCta.tsx-এ।
 *
 * ⚠️ পুরনো পাঁচটা component (`Explore`, `RecommendedForYou`, `Items`,
 * `Weekly`, `Delights`) আর ব্যবহার হয় না। মুছিনি — যাচাই করে মুছবেন:
 *
 *     grep -rn "components/Explore\|components/Items\|components/Weekly" src/
 *
 * `Delights` আর `RecommendedForYou` অন্য পাতায় থাকতে পারে, তাই
 * আন্দাজে মোছা নয়।
 */
export default async function MenuPage() {
  const settings = await getRestaurantSettings();
  const units = settings.currencyMinorUnits;
  const now = new Date();

  /**
   * ⚠️ তিনটে query, তিনটে আলাদা জিনিসের জন্য — কিন্তু একসাথে চালানো
   * হয় (`Promise.all`), ধারাবাহিকভাবে নয়। কোনোটা অন্যটার ফলের উপর
   * নির্ভর করে না, তাই পরপর `await` করলে শুধু অপেক্ষার সময়টাই যোগ হতো।
   */
  const [categoryRows, ratingRows, couponRows] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        menuItems: {
          // পাওয়া যাচ্ছে এমনগুলো আগে, তারপর নাম ধরে — নাহলে "All"
          // দৃশ্যে প্রতিটা শ্রেণির প্রথম তিনটেই বন্ধ পদ হয়ে যেতে পারত।
          orderBy: [{ isAvailable: "desc" }, { title: "asc" }],
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            imageUrl: true,
            isAvailable: true,
            calories: true,
            fatGrams: true,
            proteinGrams: true,
            prepTimeMinutes: true,
          },
        },
      },
    }),

    /**
     * প্রতিটা পদের গড় রেটিং — কেবল **অনুমোদিত** review থেকে।
     *
     * ⚠️ `groupBy`, প্রতিটা পদের সাথে relation নয়। relation-এ আনলে
     * প্রতিটা পদের সব review-র সারি টানতে হতো শুধু একটা গড় বার করতে,
     * অথচ DB নিজেই সেটা করতে পারে।
     */
    prisma.review.groupBy({
      by: ["menuItemId"],
      where: { status: "APPROVED" },
      _avg: { rating: true },
    }),

    prisma.coupon.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      // তিনটে দেখানো হয়, কিন্তু কয়েকটা বেশি আনা হয় — নিচে ব্যবহারের
      // সীমা পেরোনো কুপনগুলো বাদ পড়বে, আর তখনো যেন তিনটে থাকে।
      take: 10,
      select: {
        id: true,
        code: true,
        type: true,
        percentOff: true,
        fixedOff: true,
        minOrderValue: true,
        expiresAt: true,
        usageLimit: true,
        usageCount: true,
        restrictedCategories: { select: { name: true } },
      },
    }),
  ]);

  const ratingByItem = new Map(
    ratingRows.map((row) => [row.menuItemId, row._avg.rating])
  );

  /**
   * DB-র সারি → client component যা বোঝে সেই আকার।
   *
   * ⚠️ `price` `Number()` করা বাধ্যতামূলক: Prisma-র `Decimal` সরল
   * object নয়, তাই server component থেকে client-এ পাঠালে Next.js
   * throw করে ("Only plain objects can be passed to Client
   * Components")। দামের **লেখা** রূপটাও এখানেই তৈরি — `formatAmount`
   * মুদ্রার minor unit জানে, আর সেটা RestaurantSettings-এ, অর্থাৎ
   * server-এ।
   */
  const categories: MenuBrowserCategory[] = categoryRows
    .filter((row) => row.menuItems.length > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      items: row.menuItems.map((item) => {
        const price = Number(item.price);
        const average = ratingByItem.get(item.id);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          price,
          priceLabel: formatAmount(price.toFixed(units), settings.currency),
          imageUrl: item.imageUrl,
          isAvailable: item.isAvailable,
          calories: item.calories,
          fatGrams: item.fatGrams,
          proteinGrams: item.proteinGrams,
          prepTimeMinutes: item.prepTimeMinutes,
          // `_avg` কোনো review না থাকলে `null` দেয় — সেটাই এখানে
          // "রেটিং দেখানো হবে না"-র সংকেত।
          rating: average ?? null,
        };
      }),
    }));

  /**
   * কুপন → কার্ডের লেখা।
   *
   * ⚠️ প্রতিটা বাক্য DB-র মান থেকে বানানো, কোনো marketing copy হাতে
   * লেখা নেই — কারণ `Coupon`-এ ওরকম কোনো মাঠই নেই। পুরো যুক্তিটা
   * TodaysOffers.tsx-এর মাথায়।
   */
  const offers: MenuOffer[] = couponRows
    // ব্যবহারের সীমা পেরোনো কুপন বাদ। এটা JS-এ, কারণ Prisma-য় এক
    // কলামের সাথে আরেক কলামের তুলনা (`usageCount < usageLimit`)
    // raw SQL ছাড়া লেখা যায় না, আর কুপনের সংখ্যা এমনিতেই হাতে গোনা।
    .filter((coupon) => coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit)
    .slice(0, 3)
    .map((coupon) => {
      const discount =
        coupon.type === "PERCENT" && coupon.percentOff !== null
          ? `${coupon.percentOff}% Off`
          : coupon.fixedOff !== null
            ? `${formatAmount(Number(coupon.fixedOff).toFixed(units), settings.currency)} Off`
            : "A Discount";

      const scope =
        coupon.restrictedCategories.length > 0
          ? coupon.restrictedCategories.map((category) => category.name).join(", ")
          : "Every Order";

      const conditions = [`Use code ${coupon.code} at checkout`];
      if (coupon.minOrderValue !== null) {
        conditions.push(
          `on orders over ${formatAmount(
            Number(coupon.minOrderValue).toFixed(units),
            settings.currency
          )}`
        );
      }

      let detail = `${conditions.join(" ")}.`;
      if (coupon.expiresAt) {
        // দিন-মাস, বছর নয় — কুপন সাধারণত কয়েক সপ্তাহের, আর "2026"
        // লেখাটা কার্ডে অকারণ জায়গা নিত।
        detail += ` Ends ${coupon.expiresAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}.`;
      }

      return {
        id: coupon.id,
        code: coupon.code,
        eyebrow: scope,
        headline: `${discount} Your Order`,
        detail,
      };
    });

  return (
    <>
      <MenuHero />
      <TodaysOffers offers={offers} />
      <MenuBrowser
        categories={categories}
        kitchenOpenHour={settings.kitchenOpenHour}
        kitchenCloseHour={settings.kitchenCloseHour}
        timezone={settings.timezone}
      />
      <SignatureSection />
      <MenuComboCta />
    </>
  );
}
