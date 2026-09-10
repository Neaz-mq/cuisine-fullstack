import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRestaurantSettings } from "@/lib/get-settings";
import ReservationsHero from "@/components/reservation/ReservationsHero";
import ReservationList, { type ReservationRow } from "@/components/reservation/ReservationList";
import NewReservationCTA from "@/components/reservation/NewReservationCTA";

export const metadata: Metadata = {
  title: "My Reservations",
  description: "View, reschedule or cancel your table reservations at Cuisine.",
};

/**
 * src/app/(main)/my-reservations/page.tsx
 *
 * Figma "Web/Reservation" — গ্রাহকের নিজের booking-এর তালিকা।
 *
 * ── কে কী দেখেন ─────────────────────────────────────────────────────
 *
 * ⚠️ reservation করতে login লাগে না (`Reservation.userId` nullable),
 * তাই "আমার booking" প্রশ্নটার দুটো উত্তর থাকতে হয়:
 *
 *   • login করা থাকলে — তাঁর সব booking (`userId` মিলিয়ে)
 *   • login না থাকলে — `?ref=<id>` দিয়ে আসা একটামাত্র booking
 *
 * দ্বিতীয়টা `/track/[orderId]`-এর একই বিশ্বাস-মডেল: অনুমান-অযোগ্য
 * id-টার দখলই প্রবেশাধিকার। Congratulations modal-এর "Reservation
 * Details" বোতামটা ঠিক ওই লিঙ্কটাই দেয়, তাই অতিথি হিসেবে বুক করেও
 * নিজের booking দেখা যায়।
 *
 * ⚠️ `?ref=` দিয়ে আসা booking-এ userId থাকলে সেটা **দেখানো হয় না** —
 * অন্য কারও account-এর booking-এর id হাতে পেলেও খোলা যাবে না। কেবল
 * অতিথি booking-ই এভাবে দেখা যায়, কারণ ওগুলোর অন্য কোনো মালিক নেই।
 */
/** Prisma row-এর যতটুকু নিচের রূপান্তরে লাগে। */
type RowWithTable = {
  id: string;
  reservedAt: Date;
  createdAt: Date;
  guestCount: number;
  specialRequests: string | null;
  status: string;
  table: { label: string; name: string | null; imageUrl: string | null };
};

/**
 * Prisma row → `ReservationRow`।
 *
 * ⚠️ এটা component-এর **বাইরে**, আর সেটা ইচ্ছাকৃত।
 *
 * ভেতরে `Date.now()` ডাকা হয় — কোন booking ভবিষ্যতের সেটা ঠিক করতে।
 * component-এর শরীরে ওটা লিখলে `react-hooks/purity` আপত্তি করে:
 * render বিশুদ্ধ হওয়া উচিত, আর `Date.now()` প্রতিবার আলাদা উত্তর দেয়।
 *
 * এখানে নিয়মটা কার্যত প্রযোজ্য নয় — এটা একটা async server component,
 * প্রতি request-এ একবারই চলে, কখনো re-render হয় না। কিন্তু rule-টা
 * সেই তফাত করতে পারে না, আর `eslint-disable` বসিয়ে চুপ করানোর চেয়ে
 * অশুদ্ধ অংশটা সরিয়ে ফেলাই ভালো: তাতে নিয়মটা ভবিষ্যতে সত্যিকারের
 * কোনো ভুল ধরার ক্ষমতা হারায় না।
 *
 * পার্শ্ব-লাভ: `now` একবারই পড়া হয়, তাই তালিকার সব সারি **একই**
 * মুহূর্তের সাপেক্ষে বিচার হয় — সারি ধরে ধরে `Date.now()` ডাকলে
 * ঠিক সীমানায় থাকা একটা booking উপরে "upcoming" আর নিচে "past"
 * দেখাতে পারত।
 */
function toReservationRows(
  rows: RowWithTable[],
  fmt: { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat; bookedOn: Intl.DateTimeFormat }
): ReservationRow[] {
  const now = Date.now();

  return rows.map((row) => {
    const isFuture = row.reservedAt.getTime() > now;
    const isFinal = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(row.status);

    return {
      id: row.id,
      /**
       * Figma-র "#CUS-2025-0718"।
       *
       * ⚠️ cuid-টা দেখানো হয় না — ২৫ অক্ষরের এলোমেলো string ফোনে
       * পড়ে শোনানো যায় না, অথচ support-এ ঠিক সেটাই দরকার হয়। বছর +
       * cuid-এর শেষ ৪ অক্ষর যথেষ্ট আলাদা, আর ছোট।
       *
       * ⚠️ এটা **derived**, সংরক্ষিত নয় — অর্থাৎ অনন্য হওয়ার কোনো
       * নিশ্চয়তা নেই। একই বছরে দুটো booking-এর শেষ ৪ অক্ষর মিললে
       * দুটোরই একই reference দেখাবে। সত্যিকারের ক্রমিক নম্বর দরকার
       * হলে schema-য় একটা `reference` কলাম লাগবে।
       */
      reference: `#CUS-${row.reservedAt.getFullYear()}-${row.id.slice(-4).toUpperCase()}`,
      tableLabel: row.table.label,
      tableName: row.table.name,
      tableImage: row.table.imageUrl,
      guestCount: row.guestCount,
      specialRequests: row.specialRequests,
      status: row.status,
      dateLabel: fmt.date.format(row.reservedAt),
      timeLabel: fmt.time.format(row.reservedAt),
      bookedOnLabel: fmt.bookedOn.format(row.createdAt).replace(" at ", " • "),
      upcoming: isFuture && !isFinal,
      // ⚠️ অতীতের booking বাতিল করার কিছু নেই — সেটা হয় হয়ে গেছে,
      // নয় গ্রাহক আসেননি। route-ও একই যাচাই করে।
      cancellable: isFuture && !isFinal,
    };
  });
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, session, settings] = await Promise.all([
    searchParams,
    auth(),
    getRestaurantSettings(),
  ]);

  const userId = session?.user?.id ?? null;
  const ref = params.ref?.trim() || null;

  const rows = await prisma.reservation.findMany({
    where: userId
      ? { userId }
      : ref
        ? { id: ref, userId: null }
        : // login নেই, ref নেই — দেখানোর কিছু নেই। `id: ""` কোনো row-তে
          // মেলে না, তাই খালি তালিকা।
          { id: "" },
    include: { table: true },
    orderBy: { reservedAt: "desc" },
  });

  /**
   * ⚠️ প্রতিটা তারিখ **server-এ**, রেস্তোরাঁর নিজের timezone-এ সাজানো।
   *
   * client-এ `toLocaleString()` ডাকলে সেটা দর্শকের ঘড়ি ধরত — ছুটিতে
   * থাকা কারও কাছে সন্ধ্যা ৭টার bookingটা অন্য সময়ে দেখাত। booking-এর
   * সময় বলতে রেস্তোরাঁর সময়ই বোঝায়, আর সেটা জানে server।
   */
  const tz = settings.timezone;
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
  const bookedFmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });

  const reservations = toReservationRows(rows, {
    date: dateFmt,
    time: timeFmt,
    bookedOn: bookedFmt,
  });

  return (
    <main>
      <ReservationsHero />
      <ReservationList reservations={reservations} />
      <NewReservationCTA />
    </main>
  );
}
