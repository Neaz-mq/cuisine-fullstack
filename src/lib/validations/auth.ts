import { z } from "zod";
import { emailSchema } from "@/lib/validations/common";
import { isValidPhone } from "@/lib/phone";

/**
 * src/lib/validations/auth.ts
 *
 * The previous manual check here (`!email || !password`) let through any
 * garbage string as "email" — e.g. "asdf" would be stored as-is, since
 * nothing checked it was actually email-shaped. That matters more here
 * than most routes because this email is later used for login and for
 * order-confirmation/marketing email delivery.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: emailSchema,
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(200, "Password is too long"),

  /**
   * E.164, বৈধতা যাচাই হয় libphonenumber দিয়ে — দৈর্ঘ্য ও prefix দুটোই
   * দেশভেদে আলাদা, তাই একটা সাধারণ regex দিয়ে কাজ চলে না।
   *
   * Client একই helper ব্যবহার করে বলে এখানে সাধারণত কিছু আটকায় না — কিন্তু
   * client-এর check যেকোনো সময় bypass করা যায়, আর এই নম্বরেই পরে order
   * update যাবে, তাই এখানেও একই কড়াকড়ি থাকা দরকার।
   *
   * Optional, কারণ DB-তেও nullable: Google signup auth.ts-এর signIn
   * callback দিয়ে হয়, এই route দিয়ে নয়, আর সেখানে কোনো নম্বর আসে না।
   */
  phone: z
    .string()
    .trim()
    .refine(isValidPhone, "Please enter a valid phone number")
    .optional(),
});