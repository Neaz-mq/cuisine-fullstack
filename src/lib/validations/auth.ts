import { z } from "zod";
import { emailSchema } from "@/lib/validations/common";

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
   * E.164 only: a leading `+`, a country code that cannot start with 0,
   * then 7–15 digits total. No spaces, dashes or parentheses.
   *
   * Deliberately strict rather than forgiving. The register form already
   * assembles this from the country picker plus the national number (and
   * strips the domestic trunk `0` while doing so), so anything arriving
   * here in another shape means the client is out of step with the API —
   * which is worth a 400 rather than silently storing a number that no
   * SMS or WhatsApp gateway will ever be able to deliver to.
   *
   * Optional because the field is optional in the DB: Google signups come
   * through auth.ts's signIn callback, never this route, and provide none.
   */
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Please enter a valid phone number")
    .optional(),
});
