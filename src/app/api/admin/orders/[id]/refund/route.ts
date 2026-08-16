import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiScope } from "@/lib/require-admin";
import { parseBody } from "@/lib/validations/parse";
import { refundOrder, type RefundFailure } from "@/lib/refund-order";
import { serializeMoney } from "@/lib/money";

/**
 * POST /api/admin/orders/[id]/refund
 *
 * টাকা ফেরত পাঠায়। "refunds" scope লাগে — ইচ্ছাকৃতভাবে "orders" থেকে
 * আলাদা, কারণ order-এর status বদলানো আর গ্রাহকের কার্ডে টাকা ফেরত পাঠানো
 * এক দায়িত্ব নয় (lib/permissions.ts-এ বিস্তারিত)।
 *
 * সব প্রকৃত কাজ lib/refund-order.ts-এ। এই route কেবল ইনপুট যাচাই করে,
 * অনুমতি দেখে, আর ফল অনুবাদ করে — যাতে refund-এর যুক্তি HTTP layer থেকে
 * স্বাধীন থাকে এবং cancelOrder()-ও পরে একই function ডাকতে পারে।
 */

const refundSchema = z.object({
  /**
   * ছেড়ে দিলে যা বাকি আছে তার পুরোটা।
   *
   * ⚠️ ক্লায়েন্ট কত ফেরত যাবে সেটা "ঠিক করে দেয়" না — server নিজেই
   * Order থেকে totalAmount আর refundedAmount পড়ে সীমা যাচাই করে। এখানে
   * পাঠানো অঙ্ক কেবল একটা অনুরোধ।
   */
  amount: z.number().positive().optional(),
  reason: z.string().trim().max(300).optional(),
});

/** কোন ব্যর্থতা কোন HTTP status — 4xx বনাম 5xx আলাদা রাখা জরুরি, কারণ
 *  একটা ব্যবহারকারীর ভুল আর অন্যটা আমাদের বা Stripe-এর। */
const STATUS_BY_ERROR: Record<RefundFailure, number> = {
  "Order not found": 404,
  "Only online card payments can be refunded here": 409,
  "This order has not been paid": 409,
  "Amount must be greater than zero": 400,
  "Amount is more than what is left to refund": 409,
  "This order has no Stripe payment on record": 409,
  "Stripe refused the refund": 502,
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiScope("refunds");
  if (authResult instanceof NextResponse) return authResult;

  const parsed = await parseBody(req, refundSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await ctx.params;

  const result = await refundOrder({
    orderId: id,
    amount: parsed.amount,
    reason: parsed.reason,
    // কে ফেরত দিল সেটা ledger-এ থাকা দরকার — বিরোধ মেটানোর সময় এটাই
    // প্রথম প্রশ্ন।
    issuedById: authResult.user?.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: STATUS_BY_ERROR[result.error] ?? 400 }
    );
  }

  // ৩ দশমিকে serialize — Decimal column-এর পূর্ণ নির্ভুলতা, currency-র
  // প্রদর্শনযোগ্য দশমিক নয়। এই response client কেবল রিফ্রেশ ট্রিগার
  // করতে ব্যবহার করে; দেখানোর সংখ্যাগুলো server render থেকেই আসে,
  // যেখানে order-এর নিজের currency জানা আছে.
  return NextResponse.json({
    refundId: result.refundId,
    amount: serializeMoney(result.amount, 3),
    refundedAmount: serializeMoney(result.refundedAmount, 3),
    paymentStatus: result.paymentStatus,
  });
}
