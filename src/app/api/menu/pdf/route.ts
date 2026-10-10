import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import { displayPrice, findLiveOffers } from "@/lib/product-offers";
import { checkRateLimit } from "@/lib/rate-limit";
import { RESTAURANT_ADDRESS } from "@/lib/landing-content";
import { buildMenuPdf, type MenuPdfData } from "@/lib/menu-pdf";
import { fetchMenuPhoto } from "@/lib/menu-pdf-photos";

/**
 * GET /api/menu/pdf            -> PDF ডাউনলোড (Content-Disposition: attachment)
 * GET /api/menu/pdf?view=1     -> একই PDF, কিন্তু browser-এর নিজের tab-এ খোলে
 *
 * "Download Menu" বোতামের (components/menu/DownloadMenuButton.tsx) গন্তব্য।
 * Public, লগইন ছাড়া — `proxy.ts`-এর matcher `api` বাদ দেয়, তাই কোনো
 * redirect-ও নেই।
 *
 * ⚠️ `/api/menu`-র হুবহু একই ছাঁকনি: শুধু `isAvailable` পদ, খালি শ্রেণি বাদ,
 * `sortOrder` ধরে সাজানো। না মিললে PDF-এ এমন পদ থাকত যা অনলাইনে অর্ডারই
 * করা যায় না — আর গ্রাহক সেটা PDF দেখেই চাইতেন।
 *
 * ⚠️ `auth()` ইচ্ছাকৃতভাবে ডাকা হয় না, তাই এখানে সদস্য-বিশেষ offer
 * (isMember = false) ধরা হয়। কারণ: এই PDF সবাইকে একই বাইট দেয়, আর সেজন্যই
 * CDN-এ cache করা যায় (নিচে `s-maxage`)। cookie পড়লে Vercel ওটাকে আর cache
 * করতে পারত না — প্রতিটা ডাউনলোডে DB + PDF বানানো।
 *
 * ⚠️ rate limit-টা in-memory (lib/rate-limit.ts-এ লেখা সীমাবদ্ধতা প্রযোজ্য)।
 * আসল সুরক্ষা cache — CDN hit-এ function-ই চলে না।
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// ছবি আনা + PDF বানানো মিলিয়ে সময় লাগতে পারে (প্রতি ছবি সর্বোচ্চ ৫s, সব সমান্তরালে)।
export const maxDuration = 30;

const RESTAURANT_NAME = "Cuisine";

function hourLabel(hour: number) {
  const period = hour % 24 < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
}

/** Decimal-fraction (0.05) -> "5%"; "0.0750" -> "7.5%"। */
function pct(rate: { toNumber(): number }) {
  return `${parseFloat((rate.toNumber() * 100).toFixed(2))}%`;
}

export async function GET(request: Request) {
  const rate = checkRateLimit(request, "menu-pdf", { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many downloads. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const url = new URL(request.url);
    const inline = url.searchParams.get("view") === "1";

    const [settings, categories] = await Promise.all([
      getRestaurantSettings(),
      prisma.category.findMany({
        include: {
          menuItems: {
            where: { isAvailable: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              foodStatus: true,
              calories: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    const nonEmpty = categories.filter((c) => c.menuItems.length > 0);
    if (nonEmpty.length === 0) {
      // খালি PDF ধরিয়ে দেওয়ার চেয়ে পরিষ্কার ব্যর্থতা ভালো — বোতাম এই বার্তাই toast-এ দেখায়।
      return NextResponse.json(
        { error: "Our menu isn't available right now. Please check back soon." },
        { status: 503 }
      );
    }

    const liveOffers = await findLiveOffers(nonEmpty.flatMap((c) => c.menuItems.map((i) => i.id)));

    // `NEXT_PUBLIC_APP_URL` — sitemap.ts যেটা ব্যবহার করে। না থাকলে অনুরোধের নিজের origin।
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/+$/, "");
    const menuUrl = `${baseUrl}/menu`;

    const timeZone = settings.timezone || "Asia/Dhaka";
    const now = new Date();
    const generatedOn = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone,
    }).format(now);
    // en-CA -> "2026-10-10": ফাইলের নামে বছর-মাস-দিন, restaurant-এর সময়ে।
    const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

    let taxNote: string | null = null;
    if (settings.taxEnabled) {
      const sameRate = settings.taxRateDineIn.equals(settings.taxRateDelivery);
      const rateText = sameRate ? ` (${pct(settings.taxRateDineIn)})` : "";
      taxNote =
        settings.taxMode === "INCLUSIVE"
          ? `Prices include ${settings.taxName}${rateText}.`
          : `Prices exclude ${settings.taxName}${rateText}, added at checkout.`;
    }

    // প্রতি শ্রেণির প্রথম ২টা ছবিওয়ালা পদের ছবি — সব শ্রেণির সবগুলো সমান্তরালে।
    // কোনোটা না এলে (host অচেনা, timeout, ভাঙা ছবি) সেই শ্রেণি ছবিহীন নকশায় আঁকা হয়।
    const photosByCategory = await Promise.all(
      nonEmpty.map(async (c) => {
        const urls = c.menuItems
          .map((i) => i.imageUrl)
          .filter((u): u is string => Boolean(u))
          .slice(0, 2);
        const found = await Promise.all(urls.map((u) => fetchMenuPhoto(u)));
        return found.filter((p): p is Uint8Array => p !== null);
      })
    );

    const data: MenuPdfData = {
      restaurantName: RESTAURANT_NAME,
      address: RESTAURANT_ADDRESS,
      hoursLabel: `${hourLabel(settings.kitchenOpenHour)} \u2013 ${hourLabel(settings.kitchenCloseHour)}`,
      qrUrl: `${menuUrl}?utm_source=menu_pdf&utm_medium=qr`,
      displayUrl: menuUrl.replace(/^https?:\/\//, ""),
      generatedOn,
      currency: settings.currency,
      currencyMinorUnits: settings.currencyMinorUnits,
      taxNote,
      categories: nonEmpty.map((c, ci) => ({
        name: c.name,
        photos: photosByCategory[ci],
        items: c.menuItems.map((item) => {
          const shown = displayPrice(
            item.price,
            liveOffers.get(item.id),
            false, // সদস্য-বিশেষ offer নয় — উপরের মন্তব্য দেখুন
            settings.currency,
            settings.currencyMinorUnits
          );
          return {
            title: item.title,
            description: item.description,
            price: shown.price,
            originalPrice: shown.oldPriceLabel ? item.price.toNumber() : null,
            badge: shown.badge,
            foodStatus: item.foodStatus,
            calories: item.calories,
          };
        }),
      })),
    };

    const pdf = await buildMenuPdf(data);
    const filename = `${RESTAURANT_NAME.toLowerCase()}-menu-${isoDay}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        // ৫ মিনিট CDN-এ নতুন, তারপর ১০ মিনিট পুরোনোটা দিয়ে পেছনে নতুন বানায়।
        // দাম বদলালে/offer শেষ হলে সর্বোচ্চ ~৫ মিনিটে PDF ধরে ফেলে; footer-এ "Prices as of" আছে।
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("GET /api/menu/pdf error:", error);
    return NextResponse.json({ error: "Could not prepare the menu. Please try again." }, { status: 500 });
  }
}
