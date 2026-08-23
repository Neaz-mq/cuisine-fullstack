import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * src/lib/password-reset.ts
 *
 * Token তৈরি ও যাচাইয়ের একমাত্র জায়গা। দুটো route (forgot + reset) একই
 * hash function ব্যবহার করছে কিনা সেটা compiler-এর হাতে ছেড়ে দেওয়া
 * হয়েছে — আলাদা করে দুই জায়গায় `createHash("sha256")` লিখলে একটা বদলালে
 * অন্যটা নিঃশব্দে ভুল হয়ে যেত, আর সেই bug ধরা পড়ত "link কাজ করছে না"
 * অভিযোগ হিসেবে, stack trace হিসেবে নয়।
 */

/**
 * এক ঘণ্টা। Reset link মানে গোটা account-এর bearer credential, আর সেটা
 * এমন একটা inbox-এ বসে থাকে যা নিজেই shared, multi-device synced, বা
 * আগে থেকেই compromised হতে পারে। দীর্ঘ মেয়াদ দিলে সুবিধা সামান্য,
 * ঝুঁকি অনেক।
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * 32 byte = 256 bit entropy, base64url encode করা যাতে URL-এ কোনো
 * escaping ছাড়াই বসে (`+/=` থাকে না)। এত entropy-তে brute force
 * অর্থহীন, তাই নিচে bcrypt-এর মতো slow hash-এর দরকার নেই।
 */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256, hex।
 *
 * DB-তে কখনোই plaintext token যায় না — email-এ পাঠানো copy-টাই একমাত্র
 * plaintext। ফলে database dump ফাঁস হলেও তা থেকে একটাও কার্যকর reset
 * link বানানো যাবে না।
 *
 * এখানে bcrypt ব্যবহার না করার কারণটা ইচ্ছাকৃত: bcrypt দরকার হয় কম
 * entropy-র গোপন তথ্যে (মানুষের বাছাই করা password), যেখানে ধীরগতিই
 * প্রতিরক্ষা। 256-bit random token-এ guess করার মতো কিছু নেই, আর
 * bcrypt হলে প্রতি verify-তে অকারণ CPU খরচ হতো।
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * দুটো hash constant time-এ মেলায়।
 *
 * DB lookup `tokenHash` unique index দিয়েই হয়, তাই এই helper সেখানে
 * লাগে না। এটা আছে যেখানে হাতে থাকা দুটো hash সরাসরি তুলনা করতে হয় —
 * `===` দিয়ে করলে প্রথম অমিল byte-এই থেমে যায়, আর সেই সময়ের পার্থক্য
 * থেকে তাত্ত্বিকভাবে hash-টা byte ধরে ধরে বের করে ফেলা সম্ভব।
 */
export function safeCompareHash(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual দৈর্ঘ্য আলাদা হলে throw করে, তাই আগে দৈর্ঘ্য দেখা।
  // দৈর্ঘ্য ফাঁস হওয়াতে সমস্যা নেই — hash-এর দৈর্ঘ্য এমনিতেই ধ্রুবক।
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Email-এ যাওয়া reset link। Vercel-এ NEXT_PUBLIC_APP_URL সেট করা থাকলে
 * সেটাই, নয়তো NextAuth-এর নিজস্ব URL, আর সবশেষে localhost।
 *
 * ⚠️ Production-এ এটা ভুল হলে reset link localhost-এ চলে যাবে এবং কেউ
 * অভিযোগ করার আগ পর্যন্ত টেরই পাওয়া যাবে না — deploy করার আগে env
 * variable-টা মিলিয়ে নাও।
 */
export function resetPasswordUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}
