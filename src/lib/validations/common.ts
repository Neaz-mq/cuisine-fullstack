import { z } from "zod";

/**
 * src/lib/validations/common.ts
 *
 * Reusable pieces every per-route schema builds on, so "what counts as a
 * valid id / price / phone" is defined once instead of copy-pasted with
 * slightly different rules in 26 different route files.
 */

/** Prisma models in this project all use `@default(cuid())`, not uuid —
 * a cuid is lowercase alphanumeric, starts with "c", 24-25 chars. Kept
 * loose (min length + charset) rather than an exact-length regex so it
 * doesn't break if Prisma's cuid format ever changes length slightly. */
export const cuidSchema = z
  .string()
  .trim()
  .min(20, "Invalid id")
  .regex(/^[a-z0-9]+$/i, "Invalid id");

/** Money fields in this schema are stored as plain numbers (major units,
 * e.g. 12.99 for $12.99 — see MenuItem.price / Order totals), not integer
 * cents. Negative or absurd values are what actually caused real bugs
 * (e.g. the manual `typeof price !== "number"` check in menu-items/route.ts
 * let negative prices through). Capped at 100,000 as a sanity ceiling, not
 * a real business limit. */
export const priceSchema = z
  .number()
  .finite()
  .nonnegative("Price cannot be negative")
  .max(100_000, "Price is too large")
  .transform((n) => Math.round(n * 100) / 100); // avoid float noise like 12.9999999

/** Positive integer quantity — used for cart items, stock adjustments. */
export const quantitySchema = z.number().int().positive("Quantity must be at least 1");

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase();

/** Deliberately permissive — this app serves customers who type numbers
 * in varied local formats (spaces, dashes, +880 prefix). Strip to digits
 * and just bound the length rather than enforce a strict E.164 regex that
 * would reject real customers. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[0-9+\-\s()]+$/, "Phone number has invalid characters");

export const nonEmptyString = (label: string) =>
  z.string().trim().min(1, `${label} is required`);

/** Shared pagination query-param schema — coerces the string query params
 * (?page=2&limit=20) into numbers with sane defaults/bounds. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});