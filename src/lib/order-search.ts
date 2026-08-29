import type { Prisma } from "@/generated/prisma/client";
import { orderIdSearchToken } from "./format-order-id";

/**
 * src/lib/order-search.ts
 *
 * "খোঁজো" বাক্সটা আসলে কীসের মধ্যে খোঁজে — এক জায়গায়।
 *
 * ⚠️ শর্তটা আগে দু'বার লেখা ছিল, /admin আর /admin/orders-এ আলাদা
 * করে। দুটোই তখন শুধু নাম আর ইমেইল দেখত, তাই দুটোতেই অর্ডার আইডি
 * খুঁজলে কিছুই মিলত না। একটা কপি সারালে অন্যটা পিছিয়ে থাকত, তাই
 * সংজ্ঞাটাই এখানে সরিয়ে আনা হলো।
 *
 * `import type` — শুধু ধরন, কোনো মান নয়। Prisma client-টা এতে
 * browser bundle-এ ঢোকে না।
 */
export function orderSearchFilter(query?: string | null): Prisma.OrderWhereInput | null {
  const q = query?.trim();
  if (!q) return null;

  // firstName/lastName আলাদা কলাম, তাই "Sojib Ali" লিখলে ওদিক থেকে
  // মিলবে না — কিন্তু নিবন্ধিত গ্রাহকের পুরো নামটা User.name-এ একটাই
  // কলামে থাকে, আর তালিকায় সেটাই দেখানো হয়। অতিথি অর্ডারে নাম
  // দু'ভাগে, সেখানে যেকোনো এক অংশ দিয়ে খুঁজতে হবে।
  const or: Prisma.OrderWhereInput[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
    { user: { name: { contains: q, mode: "insensitive" } } },
    { user: { email: { contains: q, mode: "insensitive" } } },
  ];

  const idToken = orderIdSearchToken(q);
  if (idToken) {
    /**
     * `endsWith` নয়, `contains` — যদিও দেখানো আইডিটা cuid-এর ঠিক
     * শেষ ছয় অক্ষর। কারণ ব্যবহারকারী প্রায়ই অর্ধেক টাইপ করেন
     * ("#ORD-V7BT"), আর তখন endsWith কিছুই ফেরাত না। পুরো ছয় অক্ষর
     * দিলে contains-ও ঠিক সেই একটাই অর্ডার ফেরায়, কাজেই নির্ভুলতায়
     * কিছু হারায় না।
     *
     * `mode: "insensitive"` বাধ্যতামূলক: cuid সবসময় ছোট হাতের, অথচ
     * তালিকায় আইডিটা বড় হাতের করে দেখানো হয় — কেউ কপি করলে তাই
     * বড় হাতেরই পান।
     *
     * ⚠️ এটা primary key-র index ব্যবহার করতে পারে না (ILIKE '%…%'),
     * অর্থাৎ পুরো টেবিল পড়া। শুধু কেউ সত্যিই কিছু খুঁজলে তবেই চলে,
     * আর একটা রেস্তোরাঁর অর্ডার-সংখ্যায় সেটা নগণ্য। টেবিলটা লাখের
     * ঘরে গেলে তখন একটা আলাদা, index করা `reference` কলাম বানানোই
     * ঠিক পথ — এই hack বড় করার নয়।
     */
    or.push({ id: { contains: idToken, mode: "insensitive" } });
  }

  return { OR: or };
}