"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Clock, MapPin, StickyNote, Users } from "lucide-react";
import { toast } from "react-toastify";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * page.tsx থেকে যা আসে — Prisma row নয়, সাজানো একটা সরল আকার।
 *
 * ⚠️ প্রতিটা তারিখ **সাজানো string**, `Date` নয়।
 *
 * server component থেকে client-এ `Date` পাঠানো যায় (Next সেটা
 * serialize করে), কিন্তু তারপর `toLocaleString()` ডাকলে সেটা
 * **দর্শকের** ঘড়ি ধরত — ছুটিতে থাকা কারও কাছে সন্ধ্যা ৭টার bookingটা
 * অন্য সময়ে দেখাত। রেস্তোরাঁর নিজের timezone-এ সাজানো ছাড়া অন্য
 * কিছু এখানে অর্থহীন, আর সেটা জানে server।
 */
export type ReservationRow = {
  id: string;
  /** "#CUS-2026-0718" — মানুষের পড়ার মতো, cuid নয়। */
  reference: string;
  tableLabel: string;
  tableName: string | null;
  tableImage: string | null;
  guestCount: number;
  specialRequests: string | null;
  status: string;
  /** "Friday, 1 August 2026" */
  dateLabel: string;
  /** "7:00 PM" */
  timeLabel: string;
  /** "July 18, 2026 • 3:40 PM" */
  bookedOnLabel: string;
  /** এটা ভবিষ্যতের booking কিনা — tab ভাগ করতে। */
  upcoming: boolean;
  /** বাতিল করা যাবে কিনা (শেষ অবস্থায় নয়, আর সময় পেরোয়নি)। */
  cancellable: boolean;
};

const LOCATION = {
  name: "Cuisine Main Branch",
  address: "24/6 Park Street, Dhaka, Bangladesh",
};

/**
 * src/components/reservation/ReservationList.tsx
 *
 * Figma "Web/Reservation" — Upcoming/Past tab, প্রতিটা booking-এর
 * কার্ড, আর বাতিলের নীতি।
 *
 * ⚠️ tab-টা client state, URL-এ নয়। এটা নিছক তাকিয়ে দেখার ছাঁকনি —
 * পুরো তালিকা এমনিতেই এসে গেছে, তাই URL-এ তুললে প্রতিবার একটা
 * অকারণ server round-trip হতো। Tables পাতার status ছাঁকনিতেও একই
 * যুক্তি।
 */
export default function ReservationList({
  reservations,
}: {
  reservations: ReservationRow[];
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [confirming, setConfirming] = useState<ReservationRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  /** বাতিল সফল হলে Figma-র "Reservation Cancelled?" modal। */
  const [cancelled, setCancelled] = useState<{ refundNote: string | null } | null>(null);

  const upcoming = useMemo(() => reservations.filter((r) => r.upcoming), [reservations]);
  const past = useMemo(() => reservations.filter((r) => !r.upcoming), [reservations]);
  const visible = tab === "upcoming" ? upcoming : past;

  async function confirmCancel() {
    if (!confirming) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${confirming.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't cancel this reservation.");

      /**
       * ⚠️ টাকা ফেরতের কথাটা লুকানো হয় না।
       *
       * route-টা এখনো Stripe-এ refund পাঠায় না (ওখানকার comment
       * দ্রষ্টব্য), তাই অগ্রিম দেওয়া থাকলে গ্রাহককে বলে দেওয়া হয় কত
       * ফেরত আসার কথা আর সেটা হাতে প্রক্রিয়া হবে। চুপ করে থাকলে
       * তাঁরা ভাবতেন টাকাটা মার গেছে।
       */
      const refundNote = data.refund
        ? `${data.refund.withinFreeWindow ? "A full refund" : "A 50% refund"} of your deposit will be processed within 5 working days.`
        : null;

      setConfirming(null);
      setCancelled({ refundNote });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel this reservation.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="bg-white px-4 py-16 md:px-10 md:py-20 xl:px-20 xl:py-[100px]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 xl:gap-8">
        {/* শিরোনাম + tab */}
        <div className="flex flex-col items-stretch justify-between gap-4 min-[560px]:flex-row min-[560px]:items-center">
          <h2 className="font-frank-ruhl text-[24px] font-semibold leading-none text-black md:text-[30px]">
            Reservation
          </h2>

          <div className="flex shrink-0 gap-2">
            {(["upcoming", "past"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={`h-10 rounded-full px-4 font-sora text-[13px] font-semibold leading-none transition-colors ${
                  tab === key
                    ? "bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] text-white"
                    : "border border-black/15 text-black hover:border-black"
                }`}
              >
                {key === "upcoming" ? "Upcoming" : "Past"} (
                {key === "upcoming" ? upcoming.length : past.length})
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-[20px] bg-[#F9F6F3] px-4 py-12 text-center font-sora text-[14px] text-black/50">
            {tab === "upcoming"
              ? "No upcoming reservations. Book a table and it'll show up here."
              : "No past reservations yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {visible.map((reservation, index) => (
              <motion.article
                key={reservation.id}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, ease: EASE, delay: index * 0.05 }}
                className="flex flex-col gap-5 rounded-[20px] bg-[#F9F6F3] p-4 md:p-5 lg:flex-row"
              >
                {/**
                  * ⚠️ Figma-তে ছবির উপরে তীর (◀ ▶) আছে — একাধিক ছবির
                  * carousel। schema-য় `RestaurantTable.imageUrl` একটাই
                  * string, তাই তীরদুটো বসানো হয়নি: যে বোতাম চাপলে কিছু
                  * হয় না, সেটা না থাকার চেয়ে খারাপ।
                  */}
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-[14px] bg-black/5 lg:w-[280px] xl:w-[320px]">
                  {reservation.tableImage ? (
                    <Image
                      src={reservation.tableImage}
                      alt={reservation.tableLabel}
                      fill
                      sizes="(min-width: 1280px) 320px, (min-width: 1024px) 280px, 90vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center font-frank-ruhl text-[28px] font-semibold text-black/20">
                      {reservation.tableLabel}
                    </span>
                  )}
                </div>

                {/* মাঝের কলাম: টেবিল + বিস্তারিত */}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <h3 className="font-frank-ruhl text-[20px] font-semibold leading-none text-black">
                    {reservation.tableLabel}
                    {reservation.tableName && (
                      <span className="ml-2 font-sora text-[13px] font-normal text-black/50">
                        {reservation.tableName}
                      </span>
                    )}
                  </h3>

                  <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-1">
                    <DetailRow icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />} label="Date">
                      {reservation.dateLabel}
                    </DetailRow>
                    <DetailRow icon={<Clock className="h-4 w-4" strokeWidth={1.5} />} label="Time">
                      {reservation.timeLabel}
                    </DetailRow>
                    <DetailRow icon={<Users className="h-4 w-4" strokeWidth={1.5} />} label="Guests">
                      {reservation.guestCount}{" "}
                      {reservation.guestCount === 1 ? "Person" : "People"}
                    </DetailRow>
                    {reservation.specialRequests && (
                      <DetailRow
                        icon={<StickyNote className="h-4 w-4" strokeWidth={1.5} />}
                        label="Special Requests"
                      >
                        {reservation.specialRequests}
                      </DetailRow>
                    )}
                    <DetailRow icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />} label="Location">
                      {LOCATION.name}
                      <span className="mt-0.5 block font-sora text-[11px] font-normal text-black/50">
                        {LOCATION.address}
                      </span>
                    </DetailRow>
                  </div>
                </div>

                {/* ডান কলাম: id, অবস্থা, কাজ */}
                <div className="flex w-full shrink-0 flex-col gap-3 rounded-[16px] bg-white p-4 lg:w-[240px] xl:w-[260px]">
                  <MetaRow label="Reservation ID">{reservation.reference}</MetaRow>
                  <MetaRow label="Booked On">{reservation.bookedOnLabel}</MetaRow>

                  <span
                    className={`rounded-[10px] py-2 text-center font-sora text-[13px] font-semibold ${
                      reservation.status === "CANCELLED"
                        ? "bg-[#D72A37]/10 text-[#D72A37]"
                        : reservation.status === "CONFIRMED"
                          ? "bg-[#2C6252]/10 text-[#2C6252]"
                          : "bg-black/[0.06] text-black/60"
                    }`}
                  >
                    {toTitle(reservation.status)}
                  </span>

                  {reservation.cancellable && (
                    <>
                      {/**
                        * ⚠️ Figma-তে "Reschedule" বোতামটাও আছে, কিন্তু
                        * বসানো হয়নি।
                        *
                        * Reschedule মানে নতুন সময়ে ওই টেবিলটা খালি
                        * কিনা যাচাই করা, পুরোনো slot ছেড়ে নতুনটা দাবি
                        * করা — সবটা একটা transaction-এ, নাহলে দুটো
                        * booking একই সময়ে বসে যেতে পারে। অর্থাৎ
                        * deposit-session route-এর মতোই একটা আলাদা
                        * প্রবাহ। যে বোতাম চাপলে কিছু হয় না, সেটা না
                        * থাকার চেয়ে খারাপ।
                        */}
                      <button
                        type="button"
                        onClick={() => setConfirming(reservation)}
                        className="h-10 rounded-full bg-[#D72A37]/10 font-sora text-[13px] font-semibold text-[#D72A37] transition-colors hover:bg-[#D72A37]/15"
                      >
                        Cancel Reservation
                      </button>
                    </>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {/* বাতিলের নীতি — Figma-র লাল আইকনসহ বাক্স। */}
        {tab === "upcoming" && upcoming.length > 0 && (
          <div className="flex gap-3 rounded-[16px] bg-[#F9F6F3] p-4">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#D72A37] text-white"
            >
              <StickyNote className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <h3 className="font-frank-ruhl text-[15px] font-semibold leading-none text-black">
                Cancel Reservation
              </h3>
              <p className="mt-1.5 font-sora text-[12px] leading-[1.6] text-black/60">
                You may cancel your reservation up to 2 hours before your scheduled booking time
                at no additional charge. If you cancel less than 2 hours before your reservation,
                or after the scheduled time, 50% of the reservation payment will be deducted as a
                cancellation fee.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* নিশ্চিতকরণ */}
      {confirming && (
        <Backdrop onClose={() => !cancelling && setConfirming(null)}>
          <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-[24px] bg-white p-6 text-center">
            <h2 className="font-frank-ruhl text-[24px] font-semibold leading-tight text-black">
              Cancel {confirming.tableLabel}?
            </h2>
            <p className="font-sora text-[13px] leading-[1.6] text-black/60">
              {confirming.dateLabel} · {confirming.timeLabel}. This can&apos;t be undone — you
              would need to book again.
            </p>
            <div className="flex flex-col gap-3 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={cancelling}
                className="h-[46px] flex-1 rounded-full border border-black font-sora text-[15px] font-semibold text-black"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelling}
                className="h-[46px] flex-1 rounded-full bg-[#D72A37] font-sora text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel it"}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {/* Figma "Reservation Cancelled?" */}
      {cancelled && (
        <Backdrop onClose={() => setCancelled(null)}>
          <div className="flex w-full max-w-[555px] flex-col items-center gap-6 rounded-[30px] bg-white p-6 text-center md:gap-8 md:p-[30px]">
            <span
              aria-hidden="true"
              className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-[#FEF0E3] md:h-[194px] md:w-[194px]"
            >
              <svg
                className="h-[70px] w-[70px] md:h-[96px] md:w-[96px]"
                viewBox="0 0 100 100"
                fill="none"
                stroke="#FA7F12"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M50 6 66 14l18 2 2 18 8 16-8 16-2 18-18 2-16 8-16-8-18-2-2-18L4 66l8-16-2-18 18-2z" />
                <path d="M38 38l24 24M62 38L38 62" />
              </svg>
            </span>

            <div className="flex flex-col items-center gap-4 md:gap-5">
              <h2 className="font-frank-ruhl text-[30px] font-semibold leading-[1.14] tracking-[-0.01em] text-black md:text-[46px]">
                Reservation Cancelled
              </h2>
              <p className="font-sora text-[14px] leading-[1.6] text-black/70 md:text-[16px]">
                Your reservation has been cancelled successfully. We hope to welcome you again
                soon. Thank you for choosing Cuisine.
                {cancelled.refundNote && (
                  <span className="mt-2 block text-black">{cancelled.refundNote}</span>
                )}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 min-[420px]:flex-row">
              <Link
                href="/"
                className="flex h-[46px] flex-1 items-center justify-center rounded-full border border-black font-sora text-[16px] font-semibold text-black"
              >
                Go to Home
              </Link>
              <Link
                href="/reservation"
                className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(93.36deg,#FF9540_0%,#FF70C6_145.78%)] font-sora text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Book Another Table
              </Link>
            </div>
          </div>
        </Backdrop>
      )}
    </section>
  );
}

/**
 * ⚠️ backdrop-এ ক্লিক করলে বন্ধ, কিন্তু কার্ডে ক্লিক যেন উপরে না
 * ওঠে — তাই কার্ডে stopPropagation।
 */
function Backdrop({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-[555px]">
        {children}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] bg-white p-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F9F6F3] text-black/60"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-sora text-[11px] leading-none text-black/50">{label}</span>
        <span className="mt-1 block font-sora text-[13px] font-semibold leading-[1.4] text-black">
          {children}
        </span>
      </span>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-1 rounded-[10px] bg-[#F9F6F3] px-3 py-2">
      <span className="font-sora text-[11px] leading-none text-black/50">{label}</span>
      <span className="font-sora text-[13px] font-semibold leading-none text-black">
        {children}
      </span>
    </span>
  );
}

/** "CONFIRMED" → "Confirmed" */
function toTitle(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}
