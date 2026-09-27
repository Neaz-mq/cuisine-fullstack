import { z } from "zod";
import { isValidPhone } from "@/lib/phone";

/**
 * src/lib/validations/account.ts
 *
 * What a signed-in customer may change about their own account, from the
 * customer panel (/account/profile). Email is NOT here on purpose: it's
 * the login itself (and for Google accounts, owned by Google), so
 * changing it needs a verification flow this app doesn't have.
 */

/** Personal details + email preference. */
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
  marketingConsent: z.boolean(),
});

/**
 * Change password. `currentPassword` is required whenever the account
 * already has one (checked in the route) — so a stolen, still-open
 * session can't silently lock the owner out. Google accounts without a
 * password can set a first one (then email + password login also works).
 */
export const passwordSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(200, "Password is too long"),
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
  isDefault: boolean;
};
 