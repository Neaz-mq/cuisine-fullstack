import { prisma } from "@/lib/prisma";

/**
 * src/lib/order-reviews.ts
 *
 * অনুমোদিত order-রিভিউ পড়ার একমাত্র জায়গা — সাইটের যেকোনো পাতা
 * (Home-এর testimonial, Menu-র feedback section) এখান থেকে নেবে।
 *
 * ⚠️ `status: "APPROVED"` শর্তটা এখানে হার্ডকোড, caller-এর হাতে ছাড়া
 * হয়নি। ছেড়ে দিলে একদিন কেউ শর্তটা দিতে ভুলে যেতেন আর অননুমোদিত (বা
 * আপত্তিকর) লেখা সোজা হোমপেজে উঠে যেত। অনুমোদনের কাজটা admin-এর
 * Reviews পাতায়, যেখানে পদের রিভিউগুলোও যায়।
 *
 * ⚠️ email, userId বা orderId কিছুই ফেরত যায় না — কেবল যা পর্দায়
 * দেখানো হবে। একটা রিভিউ থেকে "কে কী অর্ডার করেছিলেন" বের করা যাওয়া
 * উচিত নয়।
 */
export async function getApprovedOrderReviews(limit = 6) {
  const reviews = await prisma.orderReview.findMany({
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, authorName: true, comment: true, createdAt: true },
  });

  return reviews.map((review) => ({
    id: review.id,
    authorName: review.authorName,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  }));
}
