import { z } from "zod";
import { cuidSchema, nonEmptyString, priceSchema } from "@/lib/validations/common";

/**
 * src/lib/validations/menu-item.ts
 *
 * Mirrors the MenuItem model (prisma/schema.prisma): title, description,
 * price, categoryId required; imageUrl optional; isAvailable defaults true.
 *
 * ── Figma-র "Add Item" modal-এর নতুন ঘরগুলো ─────────────────────────
 *
 * Nutrition (kcal/fat/protein/carb), ingredient chip, food status আর
 * prep time — সবগুলোই **ঐচ্ছিক ও nullable**।
 *
 * ⚠️ `.nullable()`-টা এখানে আলংকারিক নয়। form-এ ঘরটা খালি রেখে save
 * করলে client-কে কিছু একটা পাঠাতেই হয়, আর সেই "কিছু না"-টা `null` —
 * `undefined` JSON.stringify-এ মাঠটাই ফেলে দেয়, ফলে PATCH-এ আগের মানটা
 * থেকে যেত আর কোনো সংখ্যা **মুছে ফেলা** যেত না। imageUrl-এ ঠিক এই
 * ফাঁদটাই আছে (ওটা null নেয় না, তাই খালি string পাঠাতে হয়)।
 */

/** খালি ঘর = null, আর "12" = 12। শূন্য বৈধ, ঋণাত্মক নয়। */
const optionalNonNegativeNumber = z
  .number()
  .finite()
  .nonnegative()
  // অবাস্তব মান আটকানোর ছাদ — ব্যবসার নিয়ম নয়, টাইপো-রক্ষা
  // (কেউ "9999999" বসিয়ে ফেললে সেটা ভুল, ইচ্ছা নয়)।
  .max(100_000)
  .nullable()
  .optional();

const optionalNonNegativeInt = z
  .number()
  .int()
  .nonnegative()
  .max(100_000)
  .nullable()
  .optional();

/** খালি লেখা = null, নাহলে ছাঁটা লেখা। */
const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const createMenuItemSchema = z.object({
  title: nonEmptyString("Title"),
  description: nonEmptyString("Description"),
  price: priceSchema,
  imageUrl: z.url("Image URL must be a valid URL").optional().or(z.literal("")),
  categoryId: cuidSchema,
  isAvailable: z.boolean().default(true),

  calories: optionalNonNegativeInt,
  fatGrams: optionalNonNegativeNumber,
  proteinGrams: optionalNonNegativeNumber,
  carbGrams: optionalNonNegativeNumber,

  /**
   * ⚠️ প্রতিটা chip ছাঁটা হয়, খালিগুলো বাদ পড়ে, আর সংখ্যায় ছাদ ২০।
   * ছাদটা না দিলে একটা ভাঙা client (বা curl) হাজারটা chip পাঠিয়ে
   * সারিটা ফুলিয়ে দিতে পারত, আর তালিকার pill-টা পুরো পাতা জুড়ে বসত।
   */
  ingredientTags: z
    .array(z.string().trim().min(1).max(60))
    .max(20)
    .optional(),

  foodStatus: optionalTrimmedString(40),
  prepTimeMinutes: optionalNonNegativeInt,
});

/** All fields optional for PATCH — but at least one field must be present,
 * otherwise a PATCH with an empty body would silently "succeed" while
 * updating nothing, which is confusing for the admin UI to debug. */
export const updateMenuItemSchema = createMenuItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });
