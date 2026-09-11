import { notFound, redirect } from "next/navigation";
import OrderTrackingTimeline from "./OrderTrackingTimeline";
import MenuCTA from "@/components/chefs/MenuCTA";
import { resolveOrderAccess } from "@/lib/order-access";
import { findOrderForTracking, serializeTrackedOrder } from "@/lib/track-order";
import { getRestaurantSettings } from "@/lib/get-settings";
import { RESTAURANT_LOCATION } from "@/lib/restaurant-location";

/**
 * /track/[orderId]
 *
 * ⚠️ এই পাতাটাই ছিল আসল ফাঁকটা।
 *
 * GET /api/orders/[id]-এ auth বসানোর পরেও এই পাতা একা হাতে সব ফাঁস
 * করে দিতো — এটা একটা server component, নিজেই Prisma থেকে পড়ে, নিজেই
 * render করে, poll endpoint-টাকে ছোঁয়ও না প্রথম বার। শুধু API বন্ধ
 * করলে দরজায় তালা লাগিয়ে জানালা খোলা রাখা হতো।
 *
 * তাই দুটোই এখন এক নিয়মে চলে — lib/order-access.ts। আর select ও
 * serialize-ও এখন এক জায়গায় — lib/track-order.ts (কারণ ওখানে দেখুন)।
 *
 * ── 404 নয়, login redirect কেন ────────────────────────────────────────
 *
 * API route denial-এ 404 দেয় (enumeration আটকাতে)। কিন্তু পাতায় 404
 * ভুল উত্তর: এখানে সবচেয়ে সম্ভাব্য দৃশ্যটা কোনো আক্রমণ নয় — গ্রাহক
 * নিজেই, confirmation email-এর link ফোনে খুলেছে যেখানে সে logged out।
 * তাকে "Order not found" দেখানো মানে একটা dead end।
 *
 * তাই callbackUrl সহ /login-এ পাঠানো হয়: log in করলে সে ঠিক এই
 * পাতাতেই ফিরে আসবে। Guest order কখনো এই শাখায় পৌঁছায় না, কারণ
 * মালিকহীন order-এ bearer access সবসময় পাশ করে।
 *
 * ── Figma "Web/Order Tracking" ─────────────────────────────────────────
 *
 *   cream পটভূমি (#F9F6F3), 1280 চওড়া, section-গুলোর মাঝে 60px:
 *     ১. Order ID + অবস্থা + ৪ ধাপের timeline      (সাদা কার্ড)
 *     ২. Map — "Arriving in"                         (শুধু delivery)
 *     ৩. Order Information  |  পদ + বিল               (672 · 60 · 548)
 *   তারপর সাদা পটভূমিতে "Craving Something Else?" CTA।
 *
 * ⚠️ CTA-টা নতুন করে লেখা হয়নি — Our Chefs পাতার `MenuCTA`, কারণ Figma-র
 * frame দুটো হুবহু এক (64px শিরোনাম, 636px বিবরণ, gradient বোতাম)।
 */
export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await findOrderForTracking(orderId);
  if (!order) {
    notFound();
  }

  const access = await resolveOrderAccess(order);
  if (!access) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/track/${orderId}`)}`);
  }

  /**
   * Map-এর শুরুর পিন — রেস্তোরাঁ।
   *
   * ⚠️ Settings-এর স্থানাঙ্ক আগে, কারণ দূরত্ব-ভিত্তিক delivery ফি ঠিক ওটা
   * থেকেই মাপা হয়; map আর ফি একই বিন্দু থেকে শুরু হওয়া উচিত। admin সেটা
   * না বসিয়ে থাকলে RESTAURANT_LOCATION, যেখান থেকে assign-rider rider-এর
   * প্রথম অবস্থানও বসায়।
   *
   * poll-এ এটা আসে না, শুধু এখানে একবার — রেস্তোরাঁ তো নড়ে না।
   */
  const settings = await getRestaurantSettings();
  const origin =
    settings.restaurantLat !== null && settings.restaurantLng !== null
      ? { lat: settings.restaurantLat, lng: settings.restaurantLng }
      : { lat: RESTAURANT_LOCATION.lat, lng: RESTAURANT_LOCATION.lng };

  return (
    <>
      <section className="bg-[#F9F6F3]">
        {/**
          * ⚠️ padding হুবহু SiteNavbar-এর (`px-4 md:px-10 xl:px-0`), Carts
          * পাতার মতোই — কার্ডের কিনারা logo আর cart বোতামের সাথে এক
          * রেখায় থাকে, 1366px ল্যাপটপেও।
          */}
        <div className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-10 md:py-12 xl:px-0 xl:py-[60px]">
          <OrderTrackingTimeline
            initialOrder={await serializeTrackedOrder(order)}
            origin={origin}
          />
        </div>
      </section>

      <MenuCTA
        title="Craving Something Else?"
        description="Start Your Next Order While You Wait — We'll Prepare It Fresh with the Same Care, Quality, and Flavor as the One You're Enjoying Now."
        buttonLabel="Order Again"
        href="/menu"
      />
    </>
  );
}
