import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashResetToken } from "@/lib/password-reset";

/**
 * src/app/api/auth/reset-password/route.ts
 *
 * POST { token, password } → password বদলে দেয়, token খরচ করে ফেলে।
 */

const schema = z.object({
  token: z.string().min(1),
  // register form-এর সাথে একই minimum (minLength={6})। দুই জায়গায় দুই
  // নিয়ম হলে ব্যবহারকারী এমন password বসাতে পারতেন যা দিয়ে পরে
  // register-ই করা যেত না।
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * ভুল token, মেয়াদোত্তীর্ণ token, আর আগেই ব্যবহৃত token — তিনটেরই একই
 * বার্তা। আলাদা করলে attacker জানতে পারত কোন token একসময় বৈধ ছিল,
 * আর সেটা কখন খরচ হয়েছে।
 */
const INVALID = "This reset link is invalid or has expired. Please request a new one.";

export async function POST(request: Request) {
  // এই endpoint-এ token guess করার চেষ্টাই মূল আশঙ্কা। 256-bit token
  // brute force করা অসম্ভব, কিন্তু rate limit থাকলে চেষ্টাটা log-এও
  // ধরা পড়ে এবং DB-তে অকারণ lookup-এর ঢল আটকায়।
  const limit = checkRateLimit(request, "reset-password", {
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let token: string;
  let password: string;
  try {
    const parsed = schema.parse(await request.json());
    token = parsed.token;
    password = parsed.password;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid request"
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // দ্রুত প্রত্যাখ্যান — নিচের transaction-এ ঢোকার আগেই স্পষ্ট অবৈধ
  // ক্ষেত্রগুলো বাদ। এখানকার usedAt/expiresAt পরীক্ষা সুবিধার জন্য,
  // নিরাপত্তার ভিত্তি নয়; আসল প্রয়োগ transaction-এর ভেতরে।
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  // bcrypt cost 10 — register route-এর সাথে মেলানো। এখানে বেশি cost
  // দিলে reset করা account-গুলোর hash অন্যদের চেয়ে আলাদা হয়ে যেত,
  // যা পরে cost বদলানোর সময় বিভ্রান্তিকর।
  const passwordHash = await bcrypt.hash(password, 10);

  const claimed = await prisma.$transaction(async (tx) => {
    /**
     * Atomic claim — stockDeductedAt আর Refund-এ যে pattern, ঠিক সেটাই।
     *
     * উপরের `if (record.usedAt)` পরীক্ষাটা read-then-write, অর্থাৎ দুটো
     * অনুরোধ একসঙ্গে এলে দুটোই ওটা পেরিয়ে যেতে পারে। আসল একবার-ব্যবহার
     * নিশ্চিত হয় এখানে: WHERE-এ `usedAt: null` রেখে updateMany চালিয়ে
     * ফেরত আসা count দেখা। DB row-টা lock করে, তাই দ্বিতীয় অনুরোধ
     * count 0 পায়।
     *
     * বাস্তবে এটা ঘটে — email client link prefetch করে, ব্যবহারকারী
     * দুবার click করেন, mobile browser request retry করে।
     */
    const claim = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    if (claim.count === 0) return false;

    await tx.user.update({
      where: { id: record.userId },
      data: { password: passwordHash },
    });

    /**
     * ওই ব্যবহারকারীর বাকি সব অব্যবহৃত token নিষ্ক্রিয় করা।
     *
     * কেউ পরপর তিনবার "forgot password" চাপলে তিনটে বৈধ link তৈরি হয়।
     * একটা দিয়ে password বদলানোর পরেও বাকি দুটো এক ঘণ্টা কার্যকর
     * থাকত — অর্থাৎ যে কারণে reset করা হয়েছিল (inbox-এ কেউ ঢুকেছে)
     * সেই আশঙ্কাটাই বহাল থেকে যেত।
     */
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    return true;
  });

  if (!claimed) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  return NextResponse.json({ message: "Your password has been reset." });
}
