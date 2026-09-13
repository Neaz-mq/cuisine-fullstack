import { z } from "zod";

/**
 * POST /api/admin/transaction-methods-এর body।
 *
 * ⚠️ `.trim()` min-এর আগে, তাই কেবল space দিয়ে একটা নামহীন মাধ্যম যোগ
 * করা যায় না। ৪০ অক্ষরের সীমা — সারাংশের সারিতে নামটা এক লাইনে বসতে
 * হয়, আর তার বেশি হলে পাশের সংখ্যাগুলোর জায়গা খেয়ে ফেলত।
 */
export const transactionMethodSchema = z.object({
  kind: z.enum(["PAYMENT", "SHIPPING"]),
  name: z
    .string()
    .trim()
    .min(1, "Enter a method name")
    .max(40, "Keep the name under 40 characters"),
});
