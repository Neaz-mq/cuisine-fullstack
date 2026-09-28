import { z } from "zod";
import { isValidPhone } from "@/lib/phone";
import { newPasswordSchema } from "@/lib/validations/password";

/**
 * src/lib/validations/account.ts
 *
 * What a signed-in customer may change about their own account, from the
 * customer panel (/account/profile). Email is NOT here on purpose: it's
 * the login itself (and for Google accounts, owned by Google), so
 * changing it needs a verification flow this app doesn't have.
 */

/**
 * Figma "Gender" dropdown. Stored as the value. "" (null in the database)
 * is the dropdown's "Prefer not to say" — the default, so nobody has to
 * answer.
 */
export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number]["value"];

const GENDER_VALUES = GENDER_OPTIONS.map((option) => option.value) as [Gender, ...Gender[]];

/**
 * "YYYY-MM-DD" from <input type="date"> → a real calendar day, not in the
 * future and not before 1900. Returns null when it isn't one.
 */
export function parseBirthDate(value: string, today: Date = new Date()): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // 2026-02-31 rolls over to March — that's not a real day.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (year < 1900) return null;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return null;
  return date;
}

/** Profile Details (Figma): name, phone, date of birth, gender. */
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80, "Name is too long"),
  /**
   * E.164 ("+8801785286936") built by the form from the country picker +
   * number — same format the register page stores. Empty = remove it.
   */
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || isValidPhone(value), "Please enter a valid phone number"),
  /** "" = remove it. */
  dateOfBirth: z
    .string()
    .trim()
    .max(10)
    .optional()
    .default("")
    .refine((value) => value === "" || parseBirthDate(value) !== null, "Please enter a real date of birth"),
  /** "" = not answered. */
  gender: z.union([z.literal(""), z.enum(GENDER_VALUES)]).optional().default(""),
});

/**
 * The notification switches (Figma "Preferences"). Each switch saves on
 * its own, so every field is optional — but at least one must be sent.
 */
export const preferencesSchema = z
  .object({
    orderUpdates: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => typeof v === "boolean"), "Nothing to change");

/**
 * Change password. `currentPassword` is required whenever the account
 * already has one (checked in the route) — so a stolen, still-open
 * session can't silently lock the owner out. Google accounts without a
 * password can set a first one (then email + password login also works).
 */
export const passwordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: newPasswordSchema,
});

const field = (label: string, max: number) =>
  z.string().trim().min(1, `Please enter the ${label}`).max(max, `${label} is too long`);

/** One saved delivery address. */
export const addressSchema = z.object({
  label: field("label", 30),
  address: field("street address", 200),
  apartment: z.string().trim().max(100).optional().default(""),
  city: field("city", 80),
  state: field("state", 80),
  zip: field("zip code", 20),
  /**
   * Who to call at this address (Figma shows it under the address) — handy
   * for "Mom's place" or the office reception. E.164, or "" for none. At
   * checkout, picking the address fills this number in too.
   */
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .default("")
    .refine((value) => value === "" || isValidPhone(value), "Please enter a valid phone number"),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** A customer can keep this many — plenty for home/work/family, not a dumping ground. */
export const MAX_SAVED_ADDRESSES = 10;

/** The columns of a saved address the customer sees (API responses, checkout). */
export const ADDRESS_SELECT = {
  id: true,
  label: true,
  address: true,
  apartment: true,
  city: true,
  state: true,
  zip: true,
  phone: true,
  isDefault: true,
} as const;

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  apartment: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  isDefault: boolean;
};
