import { z } from "zod";
import { PAYMENT_CODES, SHIPPING_CODES } from "@/lib/transaction-methods";

/**
 * PATCH /api/admin/transaction-methods-এর body।
 *
 * ⚠️ `code` একটা মুক্ত string নয়, কোডে থাকা তালিকার একটা — তাই অচেনা
 * মাধ্যম বসানোর চেষ্টা validation-এই আটকায়, DB পর্যন্ত পৌঁছয় না।
 *
 * ⚠️ একসাথে পুরো তালিকা পাঠানো হয়, একটা একটা নয়। modal-এ staff কয়েকটা
 * ঘর বদলে একবার "Save Change" চাপেন; প্রতিটার জন্য আলাদা request হলে
 * মাঝপথে একটা ব্যর্থ হলে অর্ধেক বদল সংরক্ষিত থেকে যেত।
 */
const methodSchema = z.object({
  code: z.string(),
  label: z
    .string()
    .trim()
    .min(1, "Enter a name")
    .max(40, "Keep the name under 40 characters"),
  enabled: z.boolean(),
});

export const transactionMethodsSchema = z
  .object({
    kind: z.enum(["PAYMENT", "SHIPPING"]),
    methods: z.array(methodSchema).min(1).max(10),
  })
  .refine(
    (value) =>
      value.methods.every((method) =>
        (value.kind === "PAYMENT" ? (PAYMENT_CODES as string[]) : (SHIPPING_CODES as string[]))
          .includes(method.code)
      ),
    { message: "Unknown method", path: ["methods"] }
  )
  .refine(
    // ⚠️ অন্তত একটা payment মাধ্যম চালু থাকতেই হবে। দুটোই বন্ধ করে দিলে
    // checkout-এ কোনো অপশনই থাকত না, অর্থাৎ দোকানটা নীরবে বন্ধ হয়ে যেত —
    // আর staff সেটা বুঝতেন প্রথম অভিযোগ আসার পর।
    (value) => value.kind !== "PAYMENT" || value.methods.some((method) => method.enabled),
    { message: "Keep at least one payment method switched on", path: ["methods"] }
  );
