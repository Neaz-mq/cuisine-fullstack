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
});