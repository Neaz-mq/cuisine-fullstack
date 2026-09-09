import type { Metadata } from "next";
import { getRestaurantSettings } from "@/lib/get-settings";
import { formatAmount } from "@/lib/currency-format";
import ReservationHero from "@/components/reservation/ReservationHero";
import ReservationBooking from "@/components/reservation/ReservationBooking";
import DeliveryCTA from "@/components/reservation/DeliveryCTA";

export const metadata: Metadata = {
  title: "Reservation",
  description: "Reserve your perfect table at Cuisine for every special occasion.",
};

/**
 * src/app/(main)/reservation/page.tsx
 *
 * Figma "Web/Menu" (Reservation) — তিনটে অংশ, উপর থেকে নিচে।
 *
 * ⚠️ এই route-টাই ছিল না, আর সেটাই ছিল 404-এর কারণ।
 * `components/SiteNavbar.tsx`-এর তালিকায় `{ label: "Reservation",
 * href: "/reservation" }` লেখা, অথচ পাতাটা ছিল `/table`-এ। অর্থাৎ
 * navbar-এর লিঙ্কটা প্রথম দিন থেকেই ভাঙা।
 *
 * ⚠️ `/table` পাতাটা **মুছিনি**। ওটা পুরোনো `Reserve` + `Spend`
 * component ব্যবহার করে, আর এখন কোনো লিঙ্ক ওখানে যায় না। কেউ
 * bookmark করে থাকলে route-টা কাজ করবে; নিশ্চিত হয়ে পরে আলাদা
 * commit-এ সরানো বা এখানে redirect বসানো যায়।
 *
 * ⚠️ Topbar, navbar আর footer এখানে নেই — `app/(main)/layout.tsx`-এ,
 * সব পাতায় ভাগ করা।
 */
export default async function ReservationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, settings] = await Promise.all([searchParams, getRestaurantSettings()]);

  /**
   * ⚠️ অগ্রিমের অঙ্কটা **server-এ** পড়া হয়, client-এ `/api/settings`
   * ডেকে নয়।
   *
   * পাতাটা এমনিতেই server component, তাই settings একবার পড়াই যথেষ্ট —
   * আর client-এ ডাকলে প্রথম render-এ অঙ্কটা জানা থাকত না, ফলে বোতামের
   * লেখা "Confirm Reservation" থেকে "Advance Payment · $35" হয়ে
   * ঝলকাত।
   */
  const deposit = Number(settings.reservationDepositAmount);

  return (
    <main>
      <ReservationHero />
      <ReservationBooking
        // ⚠️ সময়ের ধাপগুলো রান্নাঘরের খোলা-বন্ধের সময় থেকে তৈরি হয়,
        // তাই মানদুটো server থেকেই যায় — client-এ /api/settings ডাকলে
        // প্রথম render-এ তালিকাটা খালি থাকত।
        openHour={settings.kitchenOpenHour}
        closeHour={settings.kitchenCloseHour}
        depositAmount={deposit}
        depositLabel={
          deposit > 0
            ? formatAmount(deposit, settings.currency, settings.currencyMinorUnits)
            : null
        }
        // Stripe থেকে ফেরার পর — নিচে Congratulations modal খোলে।
        bookedId={params.booked ?? null}
        depositCancelled={params.deposit === "cancelled"}
      />
      <DeliveryCTA />
    </main>
  );
}
