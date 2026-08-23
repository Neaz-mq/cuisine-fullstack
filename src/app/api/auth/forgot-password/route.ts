import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
  resetPasswordUrl,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";

/**
 * src/app/api/auth/forgot-password/route.ts
 *
 * POST { email } → সবসময় একই 200।
 */

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * সর্বদা অভিন্ন উত্তর — ঠিকানাটা নিবন্ধিত হোক বা না হোক, account-টা
 * Google-only হোক, বা email পাঠানো ব্যর্থ হোক।
 *
 * এটাই এই endpoint-এর মূল নিরাপত্তা বৈশিষ্ট্য। "No account with that
 * email" বললে endpoint-টা যাচাইকৃত ঠিকানার তালিকা তৈরির যন্ত্র হয়ে
 * যায় — একটা restaurant app-এ সেটা মানে কে এখানে খায় তার তালিকা,
 * এবং সেই ঠিকানাগুলো credential stuffing-এর জন্য সরাসরি কাজে লাগে।
 *
 * বিনিময়ে UX-এ একটু খরচ আছে: টাইপো করলে ব্যবহারকারী "sent" দেখেও
 * কিছু পাবেন না। সেটা page-এর copy-তে সামলানো হয়েছে ("if an account
 * exists"), response আলাদা করে নয়।
 */
const GENERIC_OK = {
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(request: Request) {
  // দুই স্তরের সুরক্ষা দরকার, কারণ এই endpoint অন্যের inbox-এ mail
  // পাঠায় — অর্থাৎ অপব্যবহারের শিকার হয় তৃতীয় পক্ষ, যিনি কিছুই
  // করেননি। প্রতি IP-তে ঘণ্টায় ৫টা যথেষ্ট উদার, কারণ বাস্তবে কেউ
  // দু-তিনবারের বেশি চাপে না।
  const limit = checkRateLimit(request, "forgot-password", {
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let email: string;
  try {
    const body = await request.json();
    email = schema.parse(body).email;
  } catch {
    // এখানে 400 দেওয়া নিরাপদ: এটা জানায় payload-টা ভুল, ঠিকানাটা
    // নিবন্ধিত কিনা তা নয়।
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  // অস্তিত্ব নেই → নীরবে একই উত্তর। ইচ্ছাকৃতভাবে কোনো কৃত্রিম বিলম্ব
  // যোগ করা হয়নি: response time দিয়ে পার্থক্য বোঝার চেষ্টা তাত্ত্বিকভাবে
  // সম্ভব, কিন্তু email পাঠানোর কাজটা এমনিতেই await করা হচ্ছে না বলে
  // দুই পথের সময় প্রায় একই থাকে।
  if (user) {
    const token = generateResetToken();

    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashResetToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // password null (Google দিয়ে sign up করা) হলেও token দেওয়া হচ্ছে,
    // এবং সেটাই সঠিক আচরণ: ব্যবহারকারী তাঁর inbox-এর নিয়ন্ত্রণ প্রমাণ
    // করছেন, যা ওই account-এর পরিচয়ের ভিত্তিও বটে। ফলে reset-এর পর
    // তাঁর কাছে দুটো পথ থাকবে — Google, এবং নতুন password। "আপনি
    // Google দিয়ে ঢুকেছিলেন" বলে ফিরিয়ে দিলে সেটা আবার account-এর
    // ধরন ফাঁস করত।
    const firstName = user.name?.trim().split(/\s+/)[0] || "there";

    // await করা হচ্ছে না — Resend ধীর হলে বা ব্যর্থ হলে সেটা যেন
    // response-এর সময় বা ফলাফলে ছাপ না ফেলে (উপরের timing মন্তব্য
    // দ্রষ্টব্য)। helper নিজে কখনো throw করে না, তাই এটা unhandled
    // rejection তৈরি করবে না।
    void sendPasswordResetEmail({
      to: email,
      firstName,
      resetUrl: resetPasswordUrl(token),
    });
  }

  return NextResponse.json(GENERIC_OK);
}
