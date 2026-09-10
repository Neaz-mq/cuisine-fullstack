import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/reservations/[id]/cancel
 *
 * গ্রাহকের নিজের booking বাতিল করা (Figma-র "Cancel Reservation")।
 *
 * ⚠️ `PATCH /api/reservations/[id]` **নয়** — ওটা staff-only
 * (`requireApiScope("reservations")`) আর যেকোনো status-এ নিয়ে যেতে
 * পারে। এটা গ্রাহকের জন্য, আর একটাই কাজ করে: CANCELLED। দুটোকে এক
 * করলে গ্রাহকের হাতে "SEATED" বা "COMPLETED" বসানোর ক্ষমতা চলে যেত।
 *
 * ── কে বাতিল করতে পারে ─────────────────────────────────────────────
 *
 * ⚠️ reservation করতে login লাগে না (`Reservation.userId` nullable),
 * তাই "মালিক কে" প্রশ্নের উত্তর সবসময় একটা account নয়।
 *
 *   • login করা থাকলে — reservation-টা তাঁরই হতে হবে
 *   • login না থাকলে — অতিথি booking (`userId === null`) হলে অনুমতি,
 *     কারণ ওই booking-এর একমাত্র শনাক্তকারী হলো তার অনুমান-অযোগ্য id
 *
 * এটা `/track/[orderId]`-এর সেই একই বিশ্বাস-মডেল: id-টার দখলই
 * প্রবেশাধিকার। ChatMessage-এর comment-এ ওটার ব্যাখ্যা আছে।
 *
 * ⚠️ কিন্তু একটা পার্থক্য আছে, আর সেটা মনে রাখা দরকার: ওখানে
 * id দিয়ে **পড়া** যায়, এখানে **ধ্বংস** করা যায়। কারও লিঙ্কটা হাতে
 * পেলে তিনি booking-টা বাতিল করে দিতে পারবেন। ঝুঁকিটা ছোট (কেউ
 * ইচ্ছাকৃতভাবে অন্যের লিঙ্ক নিয়ে বাতিল করবেন কেন), কিন্তু শূন্য নয়।
 * শক্ত করতে হলে বাতিলের সময় ফোন নম্বরের শেষ চার অঙ্ক মেলানো যেতে
 * পারে — সেটা আলাদা কাজ।
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rate = checkRateLimit(request, "cancel-reservation", {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const session = await auth();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, reservedAt: true, depositAmount: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const isOwner = session?.user?.id && reservation.userId === session.user.id;
  const isGuestBooking = reservation.userId === null;
  if (!isOwner && !isGuestBooking) {
    return NextResponse.json({ error: "This reservation isn't yours" }, { status: 403 });
  }

  /**
   * ⚠️ শেষ অবস্থাগুলো থেকে ফেরা যায় না।
   *
   * COMPLETED মানে গ্রাহক এসে খেয়ে গেছেন, NO_SHOW মানে আসেননি —
   * দুটোই ঘটে যাওয়া ঘটনা, "বাতিল" করার মতো কিছু নেই। CANCELLED
   * দুবার বাতিল করার চেষ্টা।
   */
  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(reservation.status)) {
    return NextResponse.json(
      { error: "This reservation can no longer be cancelled." },
      { status: 409 }
    );
  }

  /**
   * ⚠️ দাবিটা `updateMany` + status শর্ত দিয়ে, `update` দিয়ে নয়।
   *
   * উপরের `findUnique` আর নিচের লেখার মাঝে অন্য কেউ (staff, বা দ্বিতীয়
   * একটা ট্যাব) status বদলে ফেলতে পারে। শর্তটা লেখার সাথে একই
   * statement-এ থাকায় সেই ফাঁকটা বন্ধ — Order-এর stockDeductedAt আর
   * Refund-এর claim-ও এই একই ছাঁদে।
   */
  const claimed = await prisma.reservation.updateMany({
    where: { id, status: { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] } },
    data: { status: "CANCELLED" },
  });

  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "This reservation can no longer be cancelled." },
      { status: 409 }
    );
  }

  /**
   * ⚠️ টাকা ফেরত দেওয়া হয় **না** — আর এটা একটা পরিচিত ফাঁক, লুকোনো
   * সিদ্ধান্ত নয়।
   *
   * Figma-র নীতিটা হলো: নির্ধারিত সময়ের ২ ঘণ্টার বেশি আগে বাতিল করলে
   * পুরো ফেরত, তার কম হলে অগ্রিমের ৫০% কেটে রাখা। সেটা বাস্তবায়ন
   * করতে লাগবে Stripe refund + একটা ledger row + webhook মেলানো —
   * অর্থাৎ lib/refund-order.ts-এর মতো একটা গোটা প্রবাহ, তার
   * compare-and-set দাবি সহ।
   *
   * সেটা না বানিয়ে চুপচাপ বাতিল করে দিলে গ্রাহকের টাকা আটকে থাকত আর
   * কেউ জানতই না। তাই আপাতত হিসাবটা **ফেরত পাঠানো হয়** — UI সেটা
   * দেখায়, আর staff হাতে Stripe থেকে ফেরত দিতে পারেন।
   */
  const hoursUntil = (reservation.reservedAt.getTime() - Date.now()) / 3_600_000;
  const deposit = reservation.depositAmount ? Number(reservation.depositAmount) : 0;

  return NextResponse.json({
    id: reservation.id,
    status: "CANCELLED",
    refund:
      deposit > 0
        ? {
            // ২ ঘণ্টার বেশি বাকি থাকলে পুরোটা, নইলে অর্ধেক।
            dueAmount: hoursUntil > 2 ? deposit : deposit / 2,
            depositAmount: deposit,
            withinFreeWindow: hoursUntil > 2,
            /** ⚠️ সবসময় false — উপরের comment দ্রষ্টব্য। */
            processed: false,
          }
        : null,
  });
}
