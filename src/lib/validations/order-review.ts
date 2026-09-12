import { z } from "zod";

/**
 * POST /api/orders/[id]/review-এর body।
 *
 * ⚠️ কেবল `comment` — rating নেই, আর সেটা ইচ্ছাকৃত। Figma-র modal-এ
 * শুধু একটা textarea; উপরের তারাটা সাজসজ্জা, কোনো input নয়। না থাকা
 * একটা field-এর জন্য schema রাখলে পরে কেউ ধরে নিত সেটা সংরক্ষিত হচ্ছে।
 *
 * ⚠️ `.trim()` min-এর **আগে**, তাই শুধু space দিয়ে ফাঁকা রিভিউ পাঠানো
 * যায় না। 2000 অক্ষর একটা খাবারের অভিজ্ঞতার জন্য যথেষ্ট উদার, আর
 * সীমা ছাড়া রাখলে একটা request-এই মেগাবাইট ঢোকানো যেত।
 */
export const orderReviewSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, "Please write a few words about your experience")
    .max(2000, "That's a bit too long — please keep it under 2000 characters"),
});
