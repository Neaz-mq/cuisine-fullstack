import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveOrderAccess } from "@/lib/order-access";
import { parseBody } from "@/lib/validations/parse";
import { orderReviewSchema } from "@/lib/validations/order-review";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/orders/[id]/review
 *
 * Figma-র delivered-অবস্থার "How Was Your Food Experience?" modal।
 *
 * ── কে লিখতে পারেন ──────────────────────────────────────────────────
 *
 * ⚠️ অনুমতির নিয়ম হুবহু /track পাতার — `resolveOrderAccess`। অর্থাৎ
 * অতিথি অর্ডারে লিঙ্কটাই টিকিট, আর মালিকানাধীন অর্ডারে log in করতে হবে।
 * আলাদা নিয়ম লিখলে এমন হতো যে গ্রাহক নিজের অর্ডারটা দেখতে পাচ্ছেন
 * অথচ রিভিউ দিতে পারছেন না (বা উল্টোটা, যা আরও খারাপ)।
 *
 * ⚠️ কেবল DELIVERED অর্ডারে। "খাবার কেমন লাগল" প্রশ্নটার কোনো উত্তর
 * নেই যতক্ষণ খাবারটা পৌঁছয়নি, আর বাতিল অর্ডারে তো নয়ই।
 *
 * ── কেন upsert ──────────────────────────────────────────────────────
 *
 * OrderReview-তে orderId unique। গ্রাহক modal-টা দুবার খুলে দুবার
 * submit করলে (বা network ধীর হওয়ায় দুবার চাপলে) create দিয়ে P2002
 * আসত আর তিনি একটা অকারণ error দেখতেন। upsert-এ দ্বিতীয় লেখাটা
 * আগেরটাকেই বদলে দেয় — যা তিনি চাইছিলেনও।
 *
 * ⚠️ upsert-এ `status` ইচ্ছাকৃতভাবে আবার PENDING-এ ফেরত যায়: লেখা
 * বদলালে সেটা নতুন করে অনুমোদন পাওয়ার কথা, নাহলে কেউ একটা নিরীহ রিভিউ
 * অনুমোদন করিয়ে নিয়ে পরে লেখাটা বদলে দিতে পারতেন।
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ⚠️ rate limit access check-এর আগেই — নাহলে অস্তিত্বহীন id-তে বারবার
  // request পাঠিয়ে বিনা খরচে DB-তে lookup করানো যেত।
  const rate = checkRateLimit(req, "order-review", { limit: 10, windowMs: 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = await parseBody(req, orderReviewSchema);
  if (parsed instanceof NextResponse) return parsed;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true, firstName: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const access = await resolveOrderAccess(order);
  if (!access) {
    // GET-এর মতোই 404, 403 নয় — 403 নিশ্চিত করে দিত যে এই id-তে একটা
    // order আছে, আর সেটাই enumeration oracle।
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "You can review this order once it has been delivered." },
      { status: 409 }
    );
  }

  await prisma.orderReview.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      // ⚠️ userId বসে কেবল তখনই যখন অর্ডারটার একজন মালিক আছে। অতিথি
      // অর্ডারে null — সেখানে কোনো অ্যাকাউন্টই নেই, আর session-এর
      // user-কে জুড়ে দেওয়া ভুল হতো (staff অন্যের অর্ডার দেখতে পারেন)।
      userId: order.userId,
      authorName: order.firstName,
      comment: parsed.comment,
    },
    update: {
      comment: parsed.comment,
      status: "PENDING",
    },
  });

  // ⚠️ রিভিউটা ফেরত পাঠানো হয় না — client-এর কেবল "সফল" জানলেই চলে,
  // আর কম পাঠানো মানে কম ফাঁস হওয়ার সুযোগ।
  return NextResponse.json({ ok: true }, { status: 201 });
}
