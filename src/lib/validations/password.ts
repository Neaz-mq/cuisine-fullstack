import { z } from "zod";
import { PASSWORD_MIN_LENGTH, passwordMeetsRules } from "@/lib/password-rules";

/**
 * src/lib/validations/password.ts
 *
 * The one rule for any NEW password — sign up, reset link, Change
 * Password, staff accounts: at least 8 characters, an uppercase letter and
 * a number or symbol (lib/password-rules.ts, the same checklist the forms
 * show).
 *
 * ⚠️ Only for setting a password, never for logging in: accounts made
 * under the old 6-character rule must still be able to sign in. They meet
 * the new rule the next time they change their password.
 */
export const PASSWORD_RULES_MESSAGE = `Use at least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter and a number or symbol`;

export const newPasswordSchema = z
  .string()
  .max(200, "Password is too long")
  .refine(passwordMeetsRules, PASSWORD_RULES_MESSAGE);
