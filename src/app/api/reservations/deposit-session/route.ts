import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { isTableAvailable } from "@/lib/reservations";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/validations/parse";
import { createReservationSchema } from "@/lib/validations/reservation";
import { getRestaurantSettings } from "@/lib/get-settings";
import { toMoney, toStripeMinorUnits } from "@/lib/money";

/**
 * POST /api/reservations/deposit-session
 *
 * Figma-র "Advance Payment" — টেবিলটা ধরে রেখে গ্রাহককে Stripe-এ
 * পাঠানো।
 *
 * ── কেন এখানে কোনো কার্ড ফর্ম নেই ───────────────────────────────────
 *
 * ⚠️ Figma-তে "Credit card / debit card" নামে একটা ধাপ আঁকা আছে —
 * Cardholder name, Card number, CCV — কিন্তু সেটা বানানো হয়নি, আর
 * বানানো উচিতও নয়।
 *
 * নিজের ফর্মে কার্ডের নম্বর নেওয়া মানে সেই নম্বরটা আপনার browser,
 * আপনার server আর আপনার log-এ ঢোকা — অর্থাৎ PCI-DSS-এর SAQ D স্তরে
 * পড়া, যেটা বছরে একটা নিরীক্ষা আর কয়েক হাজার ডলারের ব্যাপার। Stripe
 * ব্যবহারের পুরো কারণটাই হলো কার্ডের তথ্য আপনাকে **ছোঁয়াতেই না হওয়া**।
 *
 * তার উপর এই অ্যাপে সেটা প্রযুক্তিগতভাবে সম্ভবও নয়: `@stripe/stripe-js`
 * install করা নেই, আর next.config.ts-এর CSP-তে `script-src 'self'`,
 * অর্থাৎ js.stripe.com লোডই হবে না। ওই ফাইলের comment-এ লেখাই আছে —
 * "Stripe is redirect-only checkout, not Stripe Elements"।
 *
 * তাই order আর gift card যে পথে যায়, reservation-ও সেই পথেই:
 * Stripe-এর নিজের hosted Checkout পাতায় redirect।
 *
 * ── ক্রমটা কেন এই ─────────────────────────────────────────────────
 *
 * ১. আগে Reservation তৈরি হয় `PENDING` হিসেবে — অর্থাৎ টেবিলটা
 *    **ধরা পড়ে যায়**। উল্টো করলে (আগে Stripe, পরে DB) গ্রাহক টাকা
 *    দিয়ে ফিরে এসে দেখতেন টেবিলটা ইতিমধ্যে অন্য কেউ নিয়েছে।
 * ২. তারপর Stripe session, আর তার id row-তে বসানো।
 * ৩. Stripe ব্যর্থ হলে reservation-টা সাথে সাথে CANCELLED — নাহলে
 *    একটা টেবিল চিরকাল "PENDING" হয়ে আটকে থাকত।
 *
 * webhook `checkout.session.completed` পেলে PENDING → CONFIRMED,
 * আর `checkout.session.expired` পেলে PENDING → CANCELLED।
 */
export async function POST(request: Request) {
  // /api/reservations-এর হুবহু একই সীমা — একই কাজ, একই অপব্যবহারের ঝুঁকি।
  const rate = checkRateLimit(request, "create-reservation", {
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many reservation attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(request, createReservationSchema);
  if (parsed instanceof NextResponse) return parsed;
  const { tableId, customerName, phone, guestCount, reservedAt, email, specialRequests } = parsed;

  const parsedDate = new Date(reservedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "reservedAt must be a valid date/time" }, { status: 400 });
  }
  if (parsedDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "Cannot make a reservation in the past" }, { status: 400 });
  }

  const settings = await getRestaurantSettings();
  const deposit = toMoney(settings.reservationDepositAmount);

  /**
   * ⚠️ অগ্রিম ০ মানে এই route-টা ব্যবহারই করা উচিত নয় — client তখন
   * সরাসরি /api/reservations-এ যায়। এখানে এসে পড়লে সেটা bug, আর
   * নীরবে ০ টাকার একটা Stripe session বানানোর চেয়ে বলে দেওয়াই ভালো
   * (Stripe নিজেও ০ টাকার payment session নেয় না)।
   */
  if (deposit.lessThanOrEqualTo(0)) {
    return NextResponse.json(
      { error: "Advance payment is switched off. Book without a deposit instead." },
      { status: 409 }
    );
  }

  const table = await prisma.restaurantTable.findUnique({ where: { id: tableId } });
  if (!table || !table.isActive) {
    return NextResponse.json({ error: "Table not found or currently inactive" }, { status: 404 });
  }
  if (guestCount > table.capacity) {
    return NextResponse.json(
      { error: `This table can seat a maximum of ${table.capacity} guests` },
      { status: 400 }
    );
  }

  const session = await auth();

  // ---- ধাপ ১: টেবিলটা ধরে রাখা ------------------------------------
  let reservation;
  try {
    reservation = await prisma.$transaction(
      async (tx) => {
        const free = await isTableAvailable(tableId, parsedDate, { db: tx });
        if (!free) throw new Error("TABLE_UNAVAILABLE");

        return tx.reservation.create({
          data: {
            tableId,
            customerName,
            phone,
            guestCount,
            reservedAt: parsedDate,
            // ⚠️ PENDING, CONFIRMED নয় — টাকা এখনো আসেনি। webhook
            // ছাড়া অন্য কিছু এটাকে CONFIRMED করে না।
            status: "PENDING",
            userId: session?.user?.id ?? null,
            email: email || null,
            specialRequests: specialRequests || null,
            depositAmount: deposit,
          },
          include: { table: true },
        });
      },
      // /api/reservations-এর সাথে একই isolation — দুটো একই সময়ে একই
      // slot দাবি করলে একজনই পায়।
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TABLE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "This table is already booked at that time, please pick another slot" },
        { status: 409 }
      );
    }
    throw error;
  }

  // ---- ধাপ ২: Stripe ----------------------------------------------
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = getStripeClient();

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      // Stripe নিজেই রসিদ পাঠাবে, আর ফেরার পরে আমাদেরও ঠিকানাটা লাগে।
      customer_email: email || undefined,
      line_items: [
        {
          price_data: {
            currency: settings.currency.toLowerCase(),
            product_data: {
              name: `Table reservation — ${reservation.table.label}`,
              description: `${guestCount} guest${guestCount > 1 ? "s" : ""} · ${parsedDate.toUTCString()}`,
            },
            // ⚠️ toStripeMinorUnits — ১০০ দিয়ে গুণ নয়। JPY-তে ¥১২০০
            // মানে 1200, 120000 নয়; lib/money.ts-এ পুরো ব্যাখ্যা।
            unit_amount: toStripeMinorUnits(deposit, settings.currencyMinorUnits),
          },
          quantity: 1,
        },
      ],
      /**
       * ⚠️ `purpose` ছাড়া webhook বুঝতেই পারত না এটা কীসের payment।
       * gift card-ও ঠিক এভাবেই আলাদা হয় (metadata.purpose === "gift_card")।
       */
      metadata: { purpose: "reservation_deposit", reservationId: reservation.id },
      success_url: `${appUrl}/reservation?booked=${reservation.id}`,
      cancel_url: `${appUrl}/reservation?deposit=cancelled`,
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({ url: checkoutSession.url }, { status: 201 });
  } catch (error) {
    /**
     * ⚠️ Stripe ব্যর্থ হলে ধরে রাখা টেবিলটা ছেড়ে দিতেই হবে।
     *
     * নাহলে একটা PENDING reservation চিরকাল বসে থাকত আর ওই slot-টা
     * আর কেউ নিতে পারত না — অথচ কেউ কোনোদিন টাকাও দেয়নি। কোনো
     * expiry webhook-ও আসবে না, কারণ session-টাই তৈরি হয়নি।
     */
    await prisma.reservation
      .update({ where: { id: reservation.id }, data: { status: "CANCELLED" } })
      .catch(() => {});

    console.error("Reservation deposit session failed", reservation.id, error);
    return NextResponse.json(
      { error: "Couldn't start the payment. Please try again." },
      { status: 502 }
    );
  }
}
